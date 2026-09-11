/**
 * Category-typical SAMPLE content for demo sites.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *
 * The businesses worth approaching are the ones with no website, so the only
 * facts we hold about them are a name, a category, a city, and maybe a phone
 * number and an address. A demo built strictly from that is a page of empty
 * slots reading "To be added." It is honest and it is useless: an owner shown
 * a blank template cannot picture their site, and the proposal dies there.
 *
 * So a demo may show realistic, category-typical placeholder copy -- the kind
 * of thing that WOULD go in each section -- on one condition.
 *
 * ── THE CONDITION ─────────────────────────────────────────────────────────
 *
 * Every block filled from this file is marked `sample: true` on its section,
 * rendered with a visible "Sample content" tag, and summarised in the preview's
 * own chrome. Nothing here is ever presented as a fact about the business.
 *
 * That marking is NOT the generator's choice. `enforceSampleFlags` in
 * `demo-sample-policy.ts` recomputes it from the facts we actually hold and
 * can only ever turn the flag ON. A generator -- deterministic today, possibly
 * a model tomorrow -- cannot mark invented copy as confirmed.
 *
 * ── WHAT SAMPLE COPY MAY AND MAY NOT SAY ──────────────────────────────────
 *
 * It reads as ordinary marketing copy a shop owner would recognise and edit.
 * It must stay editable-generic, never specific-and-checkable:
 *
 *   ALLOWED   "Cuts, colour and care for every kind of hair."
 *             "Walk-ins and appointments welcome."
 *   FORBIDDEN a price, a named member of staff, a year founded, an award, a
 *             certification, a testimonial, a review score, a phone number,
 *             an address, a URL, or a named neighbourhood.
 *
 * The forbidden list is not stylistic. A price or an award is a claim an owner
 * can immediately check and find wrong, and one wrong specific makes the whole
 * proposal look like it was written without looking. Generic copy reads as a
 * placeholder; a specific invention reads as a lie.
 *
 * `demo-samples.test.ts` enforces the mechanical parts of that list.
 *
 * ── TEMPLATES ─────────────────────────────────────────────────────────────
 *
 * `{name}` and `{city}` are filled by `fillSample` from application-owned
 * facts. They are the only substitutions, and no template may introduce
 * another -- so sample copy can carry the business's real name without any
 * generator ever handling it.
 */

/** One item in a services list. */
export interface SampleService {
  title: string;
  body: string;
}

/** The sample content for one business category. */
export interface CategorySamples {
  /** Small label above the hero heading. */
  eyebrow: string;
  headline: string;
  subheading: string;

  servicesHeading: string;
  servicesIntro: string;
  services: SampleService[];

  aboutHeading: string;
  aboutBody: string;
  aboutPoints: string[];

  galleryHeading: string;
  galleryBody: string;
  galleryLabels: string[];

  /** A plausible weekly schedule, shown only when we hold no real hours. */
  hours: string[];

  contactBody: string;
  /**
   * The closing prompt's heading.
   *
   * Rendered whatever we hold, so unlike the bodies below it has no variant
   * and must therefore name NO contact channel. "Drop in for a cut" above a
   * page with no address is the same broken invitation as "give us a call"
   * above a missing phone number.
   */
  ctaHeading: string;
  /**
   * The closing prompt when a phone number is listed.
   *
   * May mention calling, and must mention NOTHING ELSE -- no visiting, no
   * dropping in. It is chosen on the phone alone, so it is rendered on pages
   * that have no address to visit.
   */
  ctaBody: string;
  /**
   * The closing prompt when an address is listed but NO phone number is.
   *
   * A separate field rather than a clever rewrite of `ctaBody`, because the
   * failure it prevents is specific and embarrassing: a page that says "give
   * us a call" above a contact card reading "Phone: to be added". An owner
   * reads that as proof nobody looked. Every line here invites a VISIT and
   * never a call.
   */
  ctaBodyVisit: string;
  footerNote: string;
}

/**
 * Fill `{name}` and `{city}` from application-owned facts.
 *
 * Deliberately not a general template engine: exactly two keys, replaced
 * literally. An unknown `{placeholder}` is left untouched rather than being
 * silently blanked, so `demo-samples.test.ts` can catch a typo in a template
 * instead of it shipping as a visible hole in a customer-facing page.
 */
export function fillSample(
  template: string,
  values: { name: string; city: string },
): string {
  return template.split("{name}").join(values.name).split("{city}").join(values.city);
}

const HAIR_SALON: CategorySamples = {
  eyebrow: "Hair salon in {city}",
  headline: "Your next great haircut starts here",
  subheading:
    "Cuts, colour and care for every kind of hair, in a relaxed space in the middle of {city}.",
  servicesHeading: "What we do",
  servicesIntro: "A full service for hair, from a trim to a complete change.",
  services: [
    {
      title: "Cuts and styling",
      body: "Precision cuts and finishes for every hair type, shaped around how you actually wear your hair day to day.",
    },
    {
      title: "Colour",
      body: "From subtle tones and root touch-ups to a full change of direction, with care taken to keep hair in good condition.",
    },
    {
      title: "Treatments",
      body: "Conditioning and repair treatments that keep colour bright and hair feeling healthy between visits.",
    },
    {
      title: "Occasions",
      body: "Styling for weddings, events and the days when you want to look your very best.",
    },
  ],
  aboutHeading: "About the salon",
  aboutBody:
    "{name} is a hair salon in {city}. We take the time to talk through what you want before we start, and we keep the atmosphere calm and unhurried while we work.",
  aboutPoints: [
    "Appointments and walk-ins both welcome",
    "Stylists comfortable with every hair type",
    "An unhurried hour, not a conveyor belt",
  ],
  galleryHeading: "Our work",
  galleryBody: "A look inside the salon and some of the styles we have created.",
  galleryLabels: ["The salon", "Cut and colour", "Styling in progress", "Finished look"],
  hours: ["Tuesday to Friday   9:00 - 19:00", "Saturday   9:00 - 17:00", "Sunday and Monday   Closed"],
  contactBody: "Call to book a time that suits you, or drop in and say hello.",
  ctaHeading: "Book your next appointment",
  ctaBody: "Give us a call and we will find a time that works around you.",
  ctaBodyVisit: "Come in and we will find a time that works around you.",
  footerNote: "Hair salon in {city}.",
};

const BARBER: CategorySamples = {
  eyebrow: "Barber shop in {city}",
  headline: "A proper cut, a proper shave",
  subheading: "Traditional barbering in {city}, with no fuss and no appointment needed.",
  servicesHeading: "What we do",
  servicesIntro: "Classic barbering, done properly.",
  services: [
    {
      title: "Haircuts",
      body: "Scissor and clipper cuts, from a tidy-up to a full restyle, finished the way you want it.",
    },
    {
      title: "Beard trims",
      body: "Shaping, tidying and lining out, keeping the beard in the shape that suits your face.",
    },
    {
      title: "Hot towel shave",
      body: "A traditional wet shave with hot towels and a close, comfortable finish.",
    },
    {
      title: "Kids cuts",
      body: "Quick, patient haircuts for younger customers, with no drama.",
    },
  ],
  aboutHeading: "About the shop",
  aboutBody:
    "{name} is a barber shop in {city}. Straightforward barbering, a decent chair and a conversation if you want one.",
  aboutPoints: ["Walk-ins always welcome", "Cash and card accepted", "In and out without a long wait"],
  galleryHeading: "The shop",
  galleryBody: "A look at the chairs, the shop and a few recent cuts.",
  galleryLabels: ["The shop front", "The chairs", "Recent cut", "Beard work"],
  hours: ["Monday to Friday   9:00 - 18:30", "Saturday   8:30 - 17:00", "Sunday   Closed"],
  contactBody: "Walk in, or call ahead if you would rather have a set time.",
  ctaHeading: "Ready for a cut?",
  ctaBody: "No appointment needed. Call ahead if you prefer a set time.",
  ctaBodyVisit: "No appointment needed. Just come in and take a seat.",
  footerNote: "Barber shop in {city}.",
};

const BEAUTY_SALON: CategorySamples = {
  eyebrow: "Beauty salon in {city}",
  headline: "Time to look after yourself",
  subheading: "Treatments for face, skin and body in a calm salon in {city}.",
  servicesHeading: "Treatments",
  servicesIntro: "A range of treatments, booked around your time.",
  services: [
    {
      title: "Facials",
      body: "Cleansing and conditioning facials chosen to suit your skin rather than a one-size routine.",
    },
    {
      title: "Waxing",
      body: "Careful waxing for face and body, with attention paid to comfort throughout.",
    },
    {
      title: "Brows and lashes",
      body: "Shaping, tinting and lash treatments to frame the face and open up the eyes.",
    },
    {
      title: "Massage",
      body: "Relaxing treatments to unwind with, whether you have half an hour or a full afternoon.",
    },
  ],
  aboutHeading: "About the salon",
  aboutBody:
    "{name} is a beauty salon in {city}. A quiet room, unhurried appointments and treatments chosen to suit you.",
  aboutPoints: ["Appointments to suit your schedule", "A calm and private space", "Treatments tailored to you"],
  galleryHeading: "The salon",
  galleryBody: "A look at the treatment rooms and the space.",
  galleryLabels: ["Reception", "Treatment room", "The space", "Details"],
  hours: ["Monday to Friday   9:30 - 19:00", "Saturday   9:00 - 17:00", "Sunday   Closed"],
  contactBody: "Call to book a treatment or to ask what would suit you best.",
  ctaHeading: "Book a treatment",
  ctaBody: "Call us and we will find an appointment that fits your week.",
  ctaBodyVisit: "Come in and we will find an appointment that fits your week.",
  footerNote: "Beauty salon in {city}.",
};

const NAIL_SALON: CategorySamples = {
  eyebrow: "Nail salon in {city}",
  headline: "Nails you will keep looking at",
  subheading: "Manicures, pedicures and nail art in {city}, done with care and time.",
  servicesHeading: "What we do",
  servicesIntro: "From a simple tidy-up to a full set.",
  services: [
    {
      title: "Manicures",
      body: "Shaping, cuticle care and a finish of your choosing, from bare and buffed to a full colour.",
    },
    {
      title: "Pedicures",
      body: "Thorough foot and nail care, finished with the colour you want and time to let it dry properly.",
    },
    {
      title: "Gel and extensions",
      body: "Longer-lasting gel colour and extensions, applied and removed with care for your natural nail.",
    },
    {
      title: "Nail art",
      body: "Anything from a single accent to a full design, worked out with you before we start.",
    },
  ],
  aboutHeading: "About us",
  aboutBody:
    "{name} is a nail salon in {city}. We take our time, we keep everything clean, and we would rather do one set properly than three in a rush.",
  aboutPoints: ["Time taken over every set", "Careful, hygienic practice", "Designs worked out with you"],
  galleryHeading: "Our work",
  galleryBody: "A few recent sets and a look at the salon.",
  galleryLabels: ["Recent set", "Nail art", "The salon", "Colour range"],
  hours: ["Monday to Saturday   10:00 - 19:00", "Sunday   11:00 - 17:00"],
  contactBody: "Call to book, or drop in and we will fit you in if we can.",
  ctaHeading: "Book your appointment",
  ctaBody: "Give us a call and tell us what you have in mind.",
  ctaBodyVisit: "Come in and tell us what you have in mind.",
  footerNote: "Nail salon in {city}.",
};

/**
 * Tattoo studios.
 *
 * The trap specific to this trade is hygiene. "Sterile, single-use needles"
 * is true of nearly every studio and still a CHECKABLE claim about this one,
 * and so is "licensed artists" -- which the policy test refuses outright. The
 * copy says the studio is clean and careful, which reads as a placeholder,
 * and leaves the owner to state their own practice in their own words.
 */
const TATTOO: CategorySamples = {
  eyebrow: "Tattoo studio in {city}",
  headline: "Your idea, drawn properly",
  subheading:
    "Custom tattoos and piercing in {city}, designed with you before a needle comes anywhere near.",
  servicesHeading: "What we do",
  servicesIntro: "From a first small piece to a full sleeve.",
  services: [
    {
      title: "Custom tattoos",
      body: "Designs drawn from your idea and worked through together until they are right, before the session is booked.",
    },
    {
      title: "Flash",
      body: "Ready-drawn designs to choose from the wall, for when you know what you like the moment you see it.",
    },
    {
      title: "Cover-ups and rework",
      body: "Straight advice on an older tattoo, and a plan for reworking or covering it that you are happy with.",
    },
    {
      title: "Piercing",
      body: "Piercing done carefully, with jewellery chosen together and aftercare explained before you leave.",
    },
  ],
  aboutHeading: "About the studio",
  aboutBody:
    "{name} is a tattoo studio in {city}. We take the time to get a design right, we keep the studio clean, and we will tell you honestly if an idea is not going to age well.",
  aboutPoints: [
    "Designs worked out with you",
    "Clean, careful practice",
    "Honest advice before anything is booked",
  ],
  galleryHeading: "Our work",
  galleryBody: "A few recent pieces and a look around the studio.",
  galleryLabels: ["Recent piece", "Fine line work", "The studio", "Flash wall"],
  hours: ["Tuesday to Saturday   12:00 - 20:00", "Sunday and Monday   Closed"],
  contactBody: "Get in touch with your idea, and we will talk it through before anything is booked.",
  ctaHeading: "Got an idea in mind?",
  ctaBody: "Give us a call and tell us about it. We will talk it through before anything is booked.",
  ctaBodyVisit: "Come by the studio with your idea and we will talk it through.",
  footerNote: "Tattoo studio in {city}.",
};

const RESTAURANT: CategorySamples = {
  eyebrow: "Restaurant in {city}",
  headline: "Come and eat with us",
  subheading: "A kitchen in {city} cooking food worth sitting down for.",
  servicesHeading: "The kitchen",
  servicesIntro: "What we cook and how we serve it.",
  services: [
    {
      title: "Our menu",
      body: "A menu that changes with what is good and in season, with something on it for most appetites.",
    },
    {
      title: "Dining in",
      body: "A room to sit down in properly, whether that is a quick lunch or a long evening.",
    },
    {
      title: "Groups and occasions",
      body: "Room for larger tables and the sort of evening that needs a bit of planning. Let us know in advance and we will sort it.",
    },
    {
      title: "Takeaway",
      body: "Much of the menu travels well, if you would rather eat at home.",
    },
  ],
  aboutHeading: "About us",
  aboutBody:
    "{name} is a restaurant in {city}. We cook what we would want to eat, we serve it without ceremony, and we are glad when people stay a while.",
  aboutPoints: ["Bookings and walk-ins welcome", "Room for larger tables", "Dietary requirements catered for"],
  galleryHeading: "The place",
  galleryBody: "A look at the dining room, the kitchen and a few of the dishes.",
  galleryLabels: ["The dining room", "From the kitchen", "A dish", "The bar"],
  hours: ["Tuesday to Thursday   17:00 - 22:00", "Friday and Saturday   12:00 - 23:00", "Sunday   12:00 - 20:00", "Monday   Closed"],
  contactBody: "Call to book a table, or just come in and see if we have room.",
  ctaHeading: "Book a table",
  ctaBody: "Give us a call and tell us when you would like to come.",
  ctaBodyVisit: "Come and see us. We will find you a table if we can.",
  footerNote: "Restaurant in {city}.",
};

const CAFE: CategorySamples = {
  eyebrow: "Cafe in {city}",
  headline: "Good coffee, somewhere to sit",
  subheading: "A cafe in {city} for a quick coffee, a slow breakfast or an afternoon with a laptop.",
  servicesHeading: "What we serve",
  servicesIntro: "Coffee, food and a place to sit down.",
  services: [
    {
      title: "Coffee",
      body: "Espresso, filter and everything in between, made properly and without a fuss.",
    },
    {
      title: "Breakfast and lunch",
      body: "Food made fresh through the day, from pastries in the morning to something more substantial at lunch.",
    },
    {
      title: "Somewhere to work",
      body: "Tables you can actually sit at for a while, if you have things to get done.",
    },
    {
      title: "Takeaway",
      body: "The whole menu to go, if you are on your way somewhere.",
    },
  ],
  aboutHeading: "About the cafe",
  aboutBody:
    "{name} is a cafe in {city}. Somewhere to start the morning, break up the afternoon, or sit quietly with a coffee and no particular plan.",
  aboutPoints: ["Coffee made properly", "Food fresh through the day", "A seat you can keep for a while"],
  galleryHeading: "The cafe",
  galleryBody: "A look at the room, the counter and what comes out of the kitchen.",
  galleryLabels: ["The room", "The counter", "Coffee", "On the plate"],
  hours: ["Monday to Friday   7:30 - 17:00", "Saturday and Sunday   8:30 - 17:00"],
  contactBody: "Drop in any time we are open, or call if you want to ask about a larger order.",
  ctaHeading: "See you soon",
  ctaBody: "We are open most of the day. Call ahead for anything large.",
  ctaBodyVisit: "We are open most of the day. Come in whenever suits you.",
  footerNote: "Cafe in {city}.",
};

const DENTIST: CategorySamples = {
  eyebrow: "Dental practice in {city}",
  headline: "Dental care without the dread",
  subheading: "A dental practice in {city} where things are explained before they are done.",
  servicesHeading: "Our care",
  servicesIntro: "Routine care and treatment, explained clearly.",
  services: [
    {
      title: "Check-ups",
      body: "Regular examinations to catch small problems while they are still small.",
    },
    {
      title: "Hygiene",
      body: "Cleaning and hygiene appointments, with practical advice for looking after things at home.",
    },
    {
      title: "Treatment",
      body: "Fillings, crowns and restorative work, with the options and the reasoning explained before you decide.",
    },
    {
      title: "Cosmetic care",
      body: "Whitening and cosmetic treatment for anyone who wants to change how their smile looks.",
    },
  ],
  aboutHeading: "About the practice",
  aboutBody:
    "{name} is a dental practice in {city}. We explain what we are doing and why, we tell you what it will cost before we start, and we do not rush appointments.",
  aboutPoints: ["Nervous patients welcome", "Costs explained before treatment", "Appointments that are not rushed"],
  galleryHeading: "The practice",
  galleryBody: "A look at the practice and the surgery.",
  galleryLabels: ["Reception", "The surgery", "Waiting area", "Equipment"],
  hours: ["Monday to Thursday   8:30 - 17:30", "Friday   8:30 - 16:00", "Weekends   Closed"],
  contactBody: "Call to arrange an appointment or to ask about registering with us.",
  ctaHeading: "Arrange an appointment",
  ctaBody: "Call the practice and we will find you a time.",
  ctaBodyVisit: "Come into the practice and we will find you a time.",
  footerNote: "Dental practice in {city}.",
};

const PHARMACY: CategorySamples = {
  eyebrow: "Pharmacy in {city}",
  headline: "Your local pharmacy",
  subheading: "Prescriptions, advice and everyday health in {city}.",
  servicesHeading: "What we offer",
  servicesIntro: "Prescriptions and advice, without an appointment.",
  services: [
    {
      title: "Prescriptions",
      body: "Dispensing prescriptions promptly, with repeat prescriptions handled so you do not have to think about them.",
    },
    {
      title: "Advice",
      body: "Ask the pharmacist about a minor complaint or a medicine you are unsure of. No appointment needed.",
    },
    {
      title: "Everyday health",
      body: "The everyday things you need, from pain relief and first aid to skincare and baby care.",
    },
    {
      title: "Health services",
      body: "A range of health services available in the pharmacy. Ask at the counter about what we offer.",
    },
  ],
  aboutHeading: "About the pharmacy",
  aboutBody:
    "{name} is a pharmacy in {city}. Somewhere to collect a prescription, ask a straight question, and get a straight answer.",
  aboutPoints: ["Pharmacist available to talk to", "Repeat prescriptions managed for you", "No appointment needed"],
  galleryHeading: "The pharmacy",
  galleryBody: "A look inside the pharmacy.",
  galleryLabels: ["The counter", "Inside", "Consultation room", "Shelves"],
  hours: ["Monday to Friday   9:00 - 18:30", "Saturday   9:00 - 17:00", "Sunday   Closed"],
  contactBody: "Call with a question, or come in and speak to the pharmacist.",
  ctaHeading: "We are here to help",
  ctaBody: "Call the pharmacy and we will help where we can.",
  ctaBodyVisit: "Drop in during opening hours and speak to the pharmacist.",
  footerNote: "Pharmacy in {city}.",
};

const BAKERY: CategorySamples = {
  eyebrow: "Bakery in {city}",
  headline: "Baked fresh, every morning",
  subheading: "A bakery in {city} where the day starts early so yours starts better.",
  servicesHeading: "From the oven",
  servicesIntro: "What comes out of the oven each day.",
  services: [
    {
      title: "Bread",
      body: "Loaves baked through the morning, so there is usually something still warm on the shelf.",
    },
    {
      title: "Pastries",
      body: "Sweet and savoury pastries made on site, best eaten the same day and rarely lasting longer.",
    },
    {
      title: "Cakes",
      body: "Cakes and slices by the piece, and whole cakes to order for the occasions that need one.",
    },
    {
      title: "Orders",
      body: "Larger orders for events and gatherings. Give us some notice and we will have it ready.",
    },
  ],
  aboutHeading: "About the bakery",
  aboutBody:
    "{name} is a bakery in {city}. We bake in small batches through the day rather than everything at dawn, which is why things run out and why they taste better.",
  aboutPoints: ["Baked on site every day", "Whole cakes to order", "Come early for the best choice"],
  galleryHeading: "The bakery",
  galleryBody: "A look at the counter and what came out of the oven today.",
  galleryLabels: ["The counter", "Fresh bread", "Pastries", "In the bakery"],
  hours: ["Tuesday to Saturday   7:00 - 17:00", "Sunday   7:30 - 14:00", "Monday   Closed"],
  contactBody: "Drop in, or call ahead for a larger order.",
  ctaHeading: "Fresh from the oven",
  ctaBody: "Call us for a larger order and we will have it ready.",
  ctaBodyVisit: "Come in and see what is out. Ask in the shop about larger orders.",
  footerNote: "Bakery in {city}.",
};

const GYM: CategorySamples = {
  eyebrow: "Gym in {city}",
  headline: "Start where you are",
  subheading: "A gym in {city} for people who want to train, whatever level they are starting from.",
  servicesHeading: "Training",
  servicesIntro: "Ways to train, whether you like company or quiet.",
  services: [
    {
      title: "Membership",
      body: "Full access to the gym floor and equipment, on terms that do not tie you up for years.",
    },
    {
      title: "Classes",
      body: "Group sessions through the week for people who train better with others around them.",
    },
    {
      title: "Personal training",
      body: "One-to-one sessions with a plan built around what you actually want to achieve.",
    },
    {
      title: "Getting started",
      body: "An introduction to the equipment and a starting plan, so a first visit is not a guessing game.",
    },
  ],
  aboutHeading: "About the gym",
  aboutBody:
    "{name} is a gym in {city}. Equipment that works, staff who will show you how to use it, and no attitude about where you are starting from.",
  aboutPoints: ["Beginners genuinely welcome", "Staff on the floor to ask", "Flexible membership terms"],
  galleryHeading: "The gym",
  galleryBody: "A look at the floor, the equipment and the studio.",
  galleryLabels: ["The gym floor", "Free weights", "Studio", "Changing rooms"],
  hours: ["Monday to Friday   6:00 - 22:00", "Saturday and Sunday   8:00 - 20:00"],
  contactBody: "Call to ask about membership or to arrange a look around.",
  ctaHeading: "Take a look around",
  ctaBody: "Call us and we will show you the place with no hard sell.",
  ctaBodyVisit: "Come in and we will show you the place with no hard sell.",
  footerNote: "Gym in {city}.",
};

const FLORIST: CategorySamples = {
  eyebrow: "Florist in {city}",
  headline: "Flowers for the days that matter",
  subheading: "A florist in {city} arranging flowers for occasions large, small and entirely ordinary.",
  servicesHeading: "What we do",
  servicesIntro: "Arrangements for every kind of occasion.",
  services: [
    {
      title: "Bouquets",
      body: "Hand-tied bouquets made to order, from a few stems to something considerably grander.",
    },
    {
      title: "Weddings",
      body: "Flowers for the whole day, worked out with you well in advance and delivered on time.",
    },
    {
      title: "Sympathy flowers",
      body: "Tributes and arrangements handled with care and discretion when they are needed.",
    },
    {
      title: "Delivery",
      body: "Local delivery so flowers arrive fresh and on the day you wanted them to.",
    },
  ],
  aboutHeading: "About the shop",
  aboutBody:
    "{name} is a florist in {city}. We buy fresh, we arrange to order, and we will happily tell you what is looking good this week.",
  aboutPoints: ["Arranged fresh to order", "Local delivery available", "Advice on what is in season"],
  galleryHeading: "Our arrangements",
  galleryBody: "A few recent arrangements and a look at the shop.",
  galleryLabels: ["The shop", "A bouquet", "Wedding flowers", "This week's stems"],
  hours: ["Monday to Friday   9:00 - 18:00", "Saturday   9:00 - 16:00", "Sunday   Closed"],
  contactBody: "Call to order, to arrange delivery, or to talk through an occasion.",
  ctaHeading: "Order flowers",
  ctaBody: "Give us a call and tell us the occasion.",
  ctaBodyVisit: "Come into the shop and tell us the occasion.",
  footerNote: "Florist in {city}.",
};

const CAR_REPAIR: CategorySamples = {
  eyebrow: "Garage in {city}",
  headline: "Repairs explained before they happen",
  subheading: "A garage in {city} that tells you what is wrong, what it costs, and what can wait.",
  servicesHeading: "What we do",
  servicesIntro: "Servicing and repairs for most makes.",
  services: [
    {
      title: "Servicing",
      body: "Routine servicing to keep a car running properly and to catch the expensive problems early.",
    },
    {
      title: "Repairs",
      body: "Diagnosis and repair across most makes and models, with the fault explained in plain terms.",
    },
    {
      title: "Inspections",
      body: "Inspections and the work needed to put things right, handled in one place.",
    },
    {
      title: "Tyres and brakes",
      body: "The wearing parts that matter most, checked and replaced when they need it and not before.",
    },
  ],
  aboutHeading: "About the garage",
  aboutBody:
    "{name} is a garage in {city}. We tell you what is wrong, what it will cost, and what can safely wait until next time.",
  aboutPoints: ["Estimates before work starts", "Plain explanations, no jargon", "Most makes and models"],
  galleryHeading: "The workshop",
  galleryBody: "A look at the workshop and the bays.",
  galleryLabels: ["The workshop", "In the bay", "Diagnostics", "The forecourt"],
  hours: ["Monday to Friday   8:00 - 18:00", "Saturday   8:00 - 13:00", "Sunday   Closed"],
  contactBody: "Call to book the car in or to describe a problem and get an idea of cost.",
  ctaHeading: "Book your car in",
  ctaBody: "Call us, describe the problem, and we will tell you what is involved.",
  ctaBodyVisit: "Bring the car in, describe the problem, and we will tell you what is involved.",
  footerNote: "Garage in {city}.",
};

/**
 * The fallback for a category with no bespoke content.
 *
 * Deliberately vaguer than the entries above. A category we have not written
 * for gets copy that could sit under any trade, because guessing at the
 * specifics of a business type we have not thought about is exactly how an
 * invented specific reaches a page.
 */
const GENERIC: CategorySamples = {
  eyebrow: "{city}",
  headline: "Welcome to {name}",
  subheading: "Serving customers in {city}.",
  servicesHeading: "What we do",
  servicesIntro: "The main things we can help with.",
  services: [
    {
      title: "Our services",
      body: "A description of the main services offered, written so a first-time customer knows what to expect.",
    },
    {
      title: "How it works",
      body: "What happens when you get in touch, and what you can expect from the first conversation onwards.",
    },
    {
      title: "Getting in touch",
      body: "The easiest ways to reach us and how quickly we usually come back to you.",
    },
  ],
  aboutHeading: "About us",
  aboutBody: "{name} is based in {city}. A short introduction to the business would go here.",
  aboutPoints: ["Local to {city}", "Straightforward to deal with", "Happy to answer questions"],
  galleryHeading: "Gallery",
  galleryBody: "A few photographs of the business.",
  galleryLabels: ["Photograph", "Photograph", "Photograph", "Photograph"],
  hours: ["Monday to Friday   9:00 - 17:00", "Saturday and Sunday   Closed"],
  contactBody: "Get in touch and we will be glad to help.",
  ctaHeading: "Get in touch",
  ctaBody: "We would be glad to hear from you.",
  ctaBodyVisit: "Come and see us. We would be glad to help.",
  footerNote: "Based in {city}.",
};

/**
 * Category key -> sample content.
 *
 * Keys match `SUPPORTED_CATEGORIES` in `osm/categories.ts`. The lookup below
 * also matches on the human label, because a stored lead carries the label
 * ("Hair salon") rather than the key ("hair-salon").
 */
const BY_CATEGORY_KEY: Readonly<Record<string, CategorySamples>> = {
  "hair-salon": HAIR_SALON,
  barber: BARBER,
  "beauty-salon": BEAUTY_SALON,
  "nail-salon": NAIL_SALON,
  // Stored as "Tattoo & piercing", which `toKey` turns into
  // "tattoo-&-piercing"; the prefix match below resolves that to this key.
  tattoo: TATTOO,
  restaurant: RESTAURANT,
  cafe: CAFE,
  dentist: DENTIST,
  pharmacy: PHARMACY,
  bakery: BAKERY,
  gym: GYM,
  florist: FLORIST,
  "car-repair": CAR_REPAIR,
};

/** Every category key with bespoke content. Exported for tests. */
export const SAMPLED_CATEGORY_KEYS: readonly string[] = Object.keys(BY_CATEGORY_KEY);

/** Normalise a stored category label to a lookup key. */
function toKey(category: string): string {
  return category.trim().toLowerCase().replace(/\s+/g, "-");
}

/**
 * Sample content for a category, falling back to the generic set.
 *
 * Total: every category resolves to something, so a business in a category we
 * have not written for still gets a complete page rather than a broken one.
 */
export function samplesForCategory(category: string): CategorySamples {
  const key = toKey(category);
  if (key in BY_CATEGORY_KEY) return BY_CATEGORY_KEY[key];

  // "Barber shop" -> "barber", "Dental practice" -> "dentist" and similar
  // label-to-key drift. Checked against the start of the key so "cafe" does
  // not match "car-repair".
  for (const candidate of SAMPLED_CATEGORY_KEYS) {
    if (key.startsWith(`${candidate}-`) || `${candidate}-shop` === key) {
      return BY_CATEGORY_KEY[candidate];
    }
  }

  return GENERIC;
}

/** The generic set, exported so tests can assert the fallback is reached. */
export const GENERIC_SAMPLES = GENERIC;
