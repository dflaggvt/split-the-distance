import { createClient } from '@supabase/supabase-js';
import { getMissingEnv, isNoRowsError } from '@/lib/stripeServer';

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
    closingTime: place.closingTime || null,
    distanceFormatted: place.distanceFormatted || null,
    priceLevel: typeof place.priceLevel === 'number' ? place.priceLevel : null,
    lat: typeof place.lat === 'number' ? place.lat : null,
    lon: typeof place.lon === 'number' ? place.lon : null,
    brand: place.brand || null,
  };
}

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter((message) => ['user', 'assistant'].includes(message?.role) && message?.content)
    .slice(-6)
    .map((message) => ({
      role: message.role,
      content: String(message.content).slice(0, 1200),
    }));
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
        { error: 'Search credits are required to use the AI assistant.', reason: 'no_credits' },
        { status: 402 }
      );
    }

    const body = await request.json();
    const question = String(body?.question || '').trim().slice(0, 1000);
    const route = body?.route || {};
    const midpoint = body?.midpoint || {};
    const driftRadius = body?.driftRadius || null;
    const messages = sanitizeMessages(body?.messages);
    const places = (Array.isArray(body?.places) ? body.places : [])
      .map(sanitizePlace)
      .filter(Boolean)
      .slice(0, 24);

    if (!question) {
      return Response.json({ error: 'Ask a question first.' }, { status: 400 });
    }
    if (!route?.fromName || !route?.toName) {
      return Response.json({ error: 'Route details are required.' }, { status: 400 });
    }
    if (!Number.isFinite(Number(midpoint?.lat)) || !Number.isFinite(Number(midpoint?.lng ?? midpoint?.lon))) {
      return Response.json({ error: 'Midpoint is required.' }, { status: 400 });
    }

    const model = process.env.OPENAI_AI_CHAT_MODEL || process.env.OPENAI_AI_PLAN_MODEL || 'gpt-5.4-mini';
    const promptPayload = {
      question,
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
      driftRadius: driftRadius?.minutes
        ? {
            minutes: Number(driftRadius.minutes),
            radiusMiles: Number.isFinite(Number(driftRadius.radiusMiles))
              ? Math.round(Number(driftRadius.radiusMiles) * 10) / 10
              : null,
          }
        : null,
      places,
      recentConversation: messages,
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
                  'You are Split The Distance AI, a route-specific planning assistant.',
                  'Answer only using the provided route, midpoint, drift radius, places, and conversation context.',
                  'Help the user choose where to meet, compare options, and turn midpoint results into a practical plan.',
                  'Do not invent places, ratings, hours, amenities, safety guarantees, traffic facts, or directions.',
                  'If the user asks for a plan, create a concise plan using the provided places and include a backup option when possible.',
                  'If there are no relevant places, tell the user to select a nearby category or widen the fairness zone.',
                  'Keep answers short, decisive, and actionable. Use bullets when useful.',
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
        max_output_tokens: 900,
      }),
    });

    const aiData = await aiResponse.json().catch(() => ({}));
    if (!aiResponse.ok) {
      console.error('[AI Ask] OpenAI error:', aiData);
      return Response.json(
        { error: 'AI assistant failed. Please try again.' },
        { status: 502 }
      );
    }

    const answer = extractOutputText(aiData).trim();
    if (!answer) {
      return Response.json(
        { error: 'AI assistant returned an empty answer. Please try again.' },
        { status: 502 }
      );
    }

    return Response.json({ answer, model });
  } catch (err) {
    console.error('[AI Ask] Error:', err);
    return Response.json(
      { error: 'Failed to answer AI question', detail: err.message },
      { status: 500 }
    );
  }
}
