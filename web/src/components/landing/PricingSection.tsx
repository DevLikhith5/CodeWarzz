import { Button } from "@/components/ui/button";
import { CheckIcon, RocketIcon } from "@/components/icons/PremiumIcons";
import { ScrollAnimationWrapper } from "@/components/ScrollAnimationWrapper";

const plans = [
  {
    name: "Free",
    description: "Perfect for getting started",
    price: "$0",
    period: "forever",
    features: [
      "Access to 500+ problems",
      "Basic code execution",
      "Community discussions",
      "Weekly contests",
      "Progress tracking",
    ],
    cta: "Start Free",
    popular: false,
  },
  {
    name: "Premium",
    description: "For serious interview prep",
    price: "$35",
    period: "per month",
    features: [
      "All 3,000+ problems",
      "Premium solutions & hints",
      "Video explanations",
      "Interview simulations",
      "Company-specific prep",
      "Priority code execution",
      "Certificate of completion",
    ],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Teams",
    description: "For companies & bootcamps",
    price: "$199",
    period: "per seat/month",
    features: [
      "Everything in Premium",
      "Team analytics dashboard",
      "Custom problem sets",
      "API access",
      "Dedicated support",
      "SSO & SAML",
      "Admin controls",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

export const PricingSection = () => {
  return (
    <section className="py-20 md:py-32" id="pricing">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section Header */}
        <ScrollAnimationWrapper>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="flex items-center justify-center gap-2 mb-4">
              <RocketIcon size={24} />
              <span className="text-sm font-medium text-primary uppercase tracking-wide">
                Pricing
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
              Choose Your Path to
              <span className="text-gradient-primary"> Mastery</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Start free and upgrade when you're ready to accelerate your journey.
            </p>
          </div>
        </ScrollAnimationWrapper>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <ScrollAnimationWrapper key={index} delay={100 + index * 100}>
              <div
                className={`relative bg-card rounded-xl border p-6 md:p-8 h-full ${
                  plan.popular
                    ? "border-primary shadow-glow scale-105"
                    : "border-border shadow-card"
                }`}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-primary text-primary-foreground text-xs font-semibold px-4 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Plan Header */}
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-foreground mb-1">
                    {plan.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {plan.description}
                  </p>
                </div>

                {/* Price */}
                <div className="mb-6">
                  <span className="text-4xl md:text-5xl font-bold text-foreground">
                    {plan.price}
                  </span>
                  <span className="text-muted-foreground ml-2">
                    {plan.period}
                  </span>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckIcon size={18} className="text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Button
                  className={`w-full ${
                    plan.popular
                      ? "bg-gradient-primary text-primary-foreground"
                      : ""
                  }`}
                  variant={plan.popular ? "default" : "outline"}
                  size="lg"
                >
                  {plan.cta}
                </Button>
              </div>
            </ScrollAnimationWrapper>
          ))}
        </div>
      </div>
    </section>
  );
};
