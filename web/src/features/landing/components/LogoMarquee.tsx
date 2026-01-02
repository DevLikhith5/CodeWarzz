import AdobeLogo from "@/assets/company_logos/adobe.svg";
import AirbnbLogo from "@/assets/company_logos/airbnb.svg";
import AmazonLogo from "@/assets/company_logos/amazon.svg";
import AppleLogo from "@/assets/company_logos/apple-logo.svg";
import MicrosoftLogo from "@/assets/company_logos/microsoft.svg";
import RedditLogo from "@/assets/company_logos/reddit.svg";
import SpotifyLogo from "@/assets/company_logos/spotify.svg";
import StripeLogo from "@/assets/company_logos/stripe.svg";
import TeslaLogo from "@/assets/company_logos/tesla.svg";

const companies = [
  { name: "Adobe", logo: AdobeLogo },
  { name: "Airbnb", logo: AirbnbLogo },
  { name: "Amazon", logo: AmazonLogo },
  { name: "Apple", logo: AppleLogo },
  { name: "Microsoft", logo: MicrosoftLogo },
  { name: "Reddit", logo: RedditLogo },
  { name: "Spotify", logo: SpotifyLogo },
  { name: "Stripe", logo: StripeLogo },
  { name: "Tesla", logo: TeslaLogo },
];

export const LogoMarquee = () => {
  return (
    <section className="py-20 md:py-28 bg-background relative overflow-hidden border-y border-border/20">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-secondary/5 via-transparent to-secondary/5" />

      <div className="container mx-auto px-4 md:px-6 mb-14">
        <p className="text-center text-xs text-muted-foreground/50 uppercase tracking-[0.3em] font-medium">
          Trusted by engineers at
        </p>
      </div>

      {/* Marquee Container */}
      <div className="relative">
        {/* Gradient Overlays */}
        {/* Gradient Overlays */}
        <div className="absolute left-0 top-0 bottom-0 w-48 md:w-64 bg-gradient-to-r from-background via-background/90 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-48 md:w-64 bg-gradient-to-l from-background via-background/90 to-transparent z-10 pointer-events-none" />

        {/* Smooth infinite scroll */}
        <div className="flex animate-marquee-left hover:[animation-play-state:paused]">
          {[...companies, ...companies, ...companies, ...companies].map((company, index) => (
            <div
              key={`logo-${index}`}
              className="flex items-center justify-center mx-8 md:mx-12 group cursor-default shrink-0"
            >
              <img
                src={company.logo}
                alt={`${company.name} logo`}
                className="h-12 w-auto object-contain grayscale opacity-70 hover:grayscale-0 hover:opacity-100 hover:scale-110 transition-all duration-300 dark:invert dark:hover:invert-0"
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
