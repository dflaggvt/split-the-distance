import { createClient } from '@supabase/supabase-js';
import { getMissingEnv, isNoRowsError } from '@/lib/stripeServer';

const ALLOWED_VIBES = new Set([
  'coffee',
  'lunch',
  'kid_friendly',
  'quiet_talk',
  'safe_public',
  'dinner_activity',
  'road_trip_break',
  'quick_handoff',
]);

const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'plans'],
  properties: {
    summary: {
      type: 'string',
      description: 'One concise sentence describing the meetup plan set.',
    },
    plans: {
      type: 'array',
      minItems: 2,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'title',
          'planType',
          'primaryPlaceId',
          'primaryPlaceName',
          'optionalSecondStopPlaceId',
          'optionalSecondStopPlaceName',
          'whyItWorks',
          'driveFairnessNote',
          'safetyOrPracticalNote',
          'shareText',
        ],
        properties: {
          title: { type: 'string' },
          planType: {
            type: 'string',
            enum: ['best_overall', 'best_fit', 'most_fun', 'safest_public', 'backup'],
          },
          primaryPlaceId: { type: 'string' },
          primaryPlaceName: { type: 'string' },
          optionalSecondStopPlaceId: { type: ['string', 'null'] },
          optionalSecondStopPlaceName: { type: ['string', 'null'] },
          whyItWorks: { type: 'string' },
          driveFairnessNote: { type: 'string' },
          safetyOrPracticalNote: { type: 'string' },
          shareText: { type: 'string' },
        },
      },
    },
  },
};

function secondsToMinutes(value) {
  const seconds = Number(value || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.round(seconds / 60);
}

function sanitizePlace(place) {
  if (!place?.id || !place?.name) return null;

  return {
    id: String(place.id),
    name: String(place.name).slice(0, 160),
    category: place.category || null,
    categoryLabel: place.categoryLabel || null,
    address: place.address || null,
    rating: typeof place.rating === 'number' ? place.rating : null,
    userRatingsTotal: typeof place.userRatingsTotal === 'number' ? place.userRatingsTotal : null,
    openNow: typeof place.openNow === 'boolean' ? place.openNow : null,
    distanceFormatted: place.distanceFormatted || null,
    priceLevel: typeof place.priceLevel === 'number' ? place.priceLevel : null,
    lat: typeof place.lat === 'number' ? place.lat : null,
    lon: typeof place.lon === 'number' ? place.lon : null,
  };
}

function extractOutputText(response) {
  if (response.output_text) return response.output_text;

  const textParts = [];
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) {
        textParts.push(content.text);
      }
    }
  }

  return textParts.join('\n');
}

async function getEntitlement(supabase, userId) {
  const [{ data: credits, error: creditsError }, { data: subscription, error: subError }] =
    await Promise.all([
      supabase
        .from('user_search_credits')
        .select('balance')
        .eq('user_id', userId)
        .limit(1)
        .single(),
      supabase
        .from('subscriptions')
        .select('plan, status')
        .eq('user_id', userId)
        .in('status', ['active', 'trialing', 'past_due'])
        .limit(1)
        .single(),
    ]);

  if (creditsError && !isNoRowsError(creditsError)) {
    throw new Error(`Failed to load credits: ${creditsError.message}`);
  }
  if (subError && !isNoRowsError(subError)) {
    throw new Error(`Failed to load subscription: ${subError.message}`);
  }

  const hasCredits = Number(credits?.balance || 0) > 0;
  const hasActiveSubscription =
    subscription?.plan && ['premium', 'enterprise'].includes(subscription.plan);

  return { hasCredits, hasActiveSubscription };
}

function validateGeneratedPlan(plan, placeIds) {
  const plans = Array.isArray(plan?.plans) ? plan.plans : [];
  if (plans.length < 2) return false;

  return plans.every((item) => {
    const hasPrimary = item?.primaryPlaceId && placeIds.has(item.primaryPlaceId);
    const hasValidSecond =
      item?.optionalSecondStopPlaceId == null || placeIds.has(item.optionalSecondStopPlaceId);
    return hasPrimary && hasValidSecond;
  });
}

export async function POST(request) {
  try {
    const missing = getMissingEnv([
      'SUPABASE_SERVICE_ROLE_KEY',
      'NEXT_PUBLIC_SB_PROJECT_URL',
      'NEXT_PUBLIC_SB_PUBLISHABLE_KEY',
      'OPENAI_API_KEY',
    ]);

    if (missing.length > 0) {
      return Response.json(
        { error: `Server misconfigured. Missing: ${missing.join(', ')}` },
        { status: 500 }
      );
    }

    const authClient = createClient(
      process.env.NEXT_PUBLIC_SB_PROJECT_URL,
      process.env.NEXT_PUBLIC_SB_PUBLISHABLE_KEY
    );
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SB_PROJECT_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || '';
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);

    if (authError || !user) {
      return Response.json(
        { error: 'Authentication required.', reason: 'auth_required' },
        { status: 401 }
      );
    }

    const { hasCredits, hasActiveSubscription } = await getEntitlement(supabase, user.id);
    if (!hasCredits && !hasActiveSubscription) {
      return Response.json(
        { error: 'Search credits are required to build an AI plan.', reason: 'no_credits' },
        { status: 402 }
      );
    }

    const body = await request.json();
    const vibe = body?.vibe;
    const route = body?.route || {};
    const midpoint = body?.midpoint || {};
    const places = (Array.isArray(body?.places) ? body.places : [])
      .map(sanitizePlace)
      .filter(Boolean)
      .slice(0, 18);

    if (!ALLOWED_VIBES.has(vibe)) {
      return Response.json({ error: 'Choose a valid plan vibe.' }, { status: 400 });
    }
    if (!route?.fromName || !route?.toName) {
      return Response.json({ error: 'Route details are required.' }, { status: 400 });
    }
    if (!Number.isFinite(Number(midpoint?.lat)) || !Number.isFinite(Number(midpoint?.lng ?? midpoint?.lon))) {
      return Response.json({ error: 'Midpoint is required.' }, { status: 400 });
    }
    if (places.length < 2) {
      return Response.json(
        { error: 'Select a nearby category first so AI can build plans from real places.' },
        { status: 400 }
      );
    }

    const placeIds = new Set(places.map((place) => place.id));
    const model = process.env.OPENAI_AI_PLAN_MODEL || 'gpt-5.4-mini';
    const promptPayload = {
      vibe,
      route: {
        fromName: route.fromName,
        toName: route.toName,
        travelMode: route.travelMode || 'DRIVING',
        midpointMode: route.midpointMode || 'time',
        distanceMiles: route.distanceMiles || null,
        durationMinutes: secondsToMinutes(route.durationSeconds),
      },
      midpoint: {
        lat: Number(midpoint.lat),
        lng: Number(midpoint.lng ?? midpoint.lon),
      },
      places,
    };

    const aiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text: [
                  'You are Split The Distance AI Plan Builder.',
                  'Create practical meetup plans from the provided midpoint results.',
                  'Only use places from the provided places array. Do not invent places, names, ratings, amenities, or locations.',
                  'Prefer places that match the requested vibe, have strong ratings, are open when known, and are practical for both people.',
                  'Keep the language useful and concise. For safe/public plans, describe public, well-lit, busy options without guaranteeing safety.',
                ].join(' '),
              },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: JSON.stringify(promptPayload),
              },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'ai_meetup_plan_response',
            strict: true,
            schema: PLAN_SCHEMA,
          },
        },
        max_output_tokens: 1800,
      }),
    });

    const aiData = await aiResponse.json().catch(() => ({}));
    if (!aiResponse.ok) {
      console.error('[AI Plan] OpenAI error:', aiData);
      return Response.json(
        { error: 'AI plan generation failed. Please try again.' },
        { status: 502 }
      );
    }

    const outputText = extractOutputText(aiData);
    const generatedPlan = JSON.parse(outputText);

    if (!validateGeneratedPlan(generatedPlan, placeIds)) {
      console.error('[AI Plan] Invalid place references:', generatedPlan);
      return Response.json(
        { error: 'AI plan generation returned invalid place references. Please try again.' },
        { status: 502 }
      );
    }

    const { data: savedPlan, error: insertError } = await supabase
      .from('ai_meetup_plans')
      .insert({
        user_id: user.id,
        vibe,
        from_name: route.fromName,
        from_lat: route.fromLat ?? null,
        from_lng: route.fromLng ?? null,
        to_name: route.toName,
        to_lat: route.toLat ?? null,
        to_lng: route.toLng ?? null,
        midpoint: promptPayload.midpoint,
        travel_mode: route.travelMode || 'DRIVING',
        midpoint_mode: route.midpointMode || 'time',
        route_summary: {
          distanceMiles: route.distanceMiles || null,
          durationSeconds: route.durationSeconds || null,
        },
        places_used: places,
        generated_plan: generatedPlan,
        model,
      })
      .select('*')
      .single();

    if (insertError) {
      throw new Error(`Failed to save AI plan: ${insertError.message}`);
    }

    return Response.json({ plan: savedPlan });
  } catch (err) {
    console.error('[AI Plan] Error:', err);
    return Response.json(
      { error: 'Failed to build AI plan', detail: err.message },
      { status: 500 }
    );
  }
}
