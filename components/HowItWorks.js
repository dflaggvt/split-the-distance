export default function HowItWorks() {
  const steps = [
    {
      num: 1,
      title: 'Enter Two Locations',
      desc: "Type your starting point and destination. We'll autocomplete as you type.",
    },
    {
      num: 2,
      title: 'We Calculate the Midpoint',
      desc: 'Not a geographic center — we find the point where both people drive the same amount of time.',
    },
    {
      num: 3,
      title: 'Discover Places to Meet',
      desc: "Restaurants, cafes, parks, and activities near the midpoint. Filter by what you're in the mood for.",
    },
  ];

  return (
    <section id="how-it-works" className="bg-white py-16 px-6 border-t border-gray-200">
      <div className="max-w-[800px] mx-auto">
        <h2 className="text-center text-[28px] font-extrabold text-gray-900 mb-10 tracking-tight">
          How It Works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step) => (
            <div key={step.num} className="text-center">
              <div className="w-10 h-10 rounded-full bg-teal-600 text-white font-bold text-lg flex items-center justify-center mx-auto mb-3">
                {step.num}
              </div>
              <h3 className="text-base font-bold text-gray-800 mb-1.5">
                {step.title}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
