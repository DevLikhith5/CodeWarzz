import { StarIcon } from "@/components/icons/PremiumIcons";
import { ScrollAnimationWrapper } from "@/components/common/ScrollAnimationWrapper";

const testimonials = [{
  quote: "CodeWarz helped me land my dream job at Google. The structured approach to problem-solving and the quality of explanations are unmatched.",
  author: "Sarah Chen",
  role: "Software Engineer at Google",
  avatar: "SC"
}, {
  quote: "After 3 months of consistent practice, I went from failing coding interviews to receiving 4 offers from top companies. Incredible platform!",
  author: "Michael Roberts",
  role: "Senior Developer at Meta",
  avatar: "MR"
}, {
  quote: "The contests are addictive and the community is amazing. I've learned more here than in 4 years of computer science education.",
  author: "Priya Sharma",
  role: "Software Engineer at Amazon",
  avatar: "PS"
}];

const companies = ["Google", "Meta", "Amazon", "Microsoft", "Apple", "Netflix", "Stripe", "Uber"];

export const TestimonialsSection = () => {
  return (
    <section className="py-20 md:py-32 bg-secondary/30">
      <div className="container mx-auto px-4 md:px-6">
        {/* Company Logos */}
        <ScrollAnimationWrapper>
          <div className="text-center mb-16">
            <p className="text-sm text-muted-foreground mb-8 uppercase tracking-wide">
              Our users work at leading tech companies
            </p>
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
              {companies.map((company, index) => (
                <span key={index} className="text-xl md:text-2xl font-bold text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                  {company}
                </span>
              ))}
            </div>
          </div>
        </ScrollAnimationWrapper>

        {/* Section Header */}
        <ScrollAnimationWrapper delay={100}>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
              Loved by <span className="text-gradient-primary">2 Million+</span> Developers
            </h2>
            <p className="text-lg text-muted-foreground">
              Join the community of developers who transformed their careers with CodeWarz.
            </p>
          </div>
        </ScrollAnimationWrapper>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          {testimonials.map((testimonial, index) => (
            <ScrollAnimationWrapper key={index} delay={200 + index * 100}>
              <div className="bg-card rounded-xl border border-border p-6 md:p-8 shadow-card hover:shadow-card-hover transition-all duration-300 h-full">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <StarIcon key={i} size={16} />
                  ))}
                </div>
                <p className="text-foreground mb-6 leading-relaxed">
                  "{testimonial.quote}"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-sm font-bold text-primary-foreground">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{testimonial.author}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            </ScrollAnimationWrapper>
          ))}
        </div>
      </div>
    </section>
  );
};