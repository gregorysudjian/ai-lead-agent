import type { CategoryPools } from "./demo-samples";

/**
 * English sample copy. See `demo-samples.ts` for the rules every line obeys.
 *
 * POOLS ARE PARALLEL WITH `demo-samples-fr.ts`: entry i of a French pool says
 * what entry i of the English pool says. A business's two language versions
 * pick the same index, so switching language changes the words and never the
 * message. `demo-samples.test.ts` fails if two pools differ in length.
 *
 * Every English `label` is null: in English a business is shown under the
 * category label it was stored with ("Hair salon"), exactly as before.
 */

const HAIR_SALON: CategoryPools = {
  label: null,
  eyebrow: ["Hair salon in {city}", "Cuts and colour in {city}"],
  headline: [
    "Your next great haircut starts here",
    "Hair that feels like yours",
    "Hair days worth looking forward to",
    "Cut, colour and care, with time taken",
  ],
  subheading: [
    "Cuts, colour and care for every kind of hair, in a relaxed salon in {city}.",
    "A salon in {city} for cuts, colour and treatments, where you are listened to before anything is cut.",
    "Every hair type, every length, and your opinion asked before the scissors come out.",
  ],
  servicesHeading: ["What we do", "Services", "In the salon"],
  servicesIntro: [
    "A full service for hair, from a trim to a complete change.",
    "From a quick trim to a whole new look.",
  ],
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
    {
      title: "Highlights and balayage",
      body: "Lighter pieces placed by hand, for a bright result that grows out gracefully.",
    },
    {
      title: "Blow-dry",
      body: "A wash and blow-dry for a smoother, fuller finish, before a big day or just because.",
    },
  ],
  aboutHeading: ["About the salon", "The salon", "Who we are"],
  aboutBody: [
    "{name} is a hair salon in {city}. We take the time to talk through what you want before we start, and we keep the atmosphere calm and unhurried while we work.",
    "At {name}, a haircut starts with a conversation. We listen, we suggest, and we only pick up the scissors once we agree on where we are going.",
    "{name} is a salon in {city} for people who want good hair without the fuss: honest advice, careful work and an hour that goes by without you noticing.",
  ],
  aboutPoints: [
    "Appointments and walk-ins both welcome",
    "Comfortable with every hair type",
    "An unhurried hour, not a conveyor belt",
    "Advice you can use at home",
    "Colour looked after with care",
  ],
  galleryHeading: ["Our work", "In the salon"],
  galleryBody: ["A look inside the salon and some of the styles we have created."],
  galleryLabels: ["The salon", "Cut and colour", "Styling in progress", "Finished look"],
  contactBody: [
    "Call to book a time that suits you, or drop in and say hello.",
    "Call ahead for a set time, or stop by and we will see what we can do.",
  ],
  ctaHeading: ["Book your next appointment", "Ready for a change?", "Your chair is waiting"],
  ctaBody: [
    "Give us a call and we will find a time that works around you.",
    "Call us, tell us what you have in mind, and we will find you a time.",
  ],
  ctaBodyVisit: [
    "Come in and we will find a time that works around you.",
    "Stop by the salon and we will find you a time.",
  ],
  footerNote: ["Hair salon in {city}."],
};

const BARBER: CategoryPools = {
  label: null,
  eyebrow: ["Barber shop in {city}", "Barbering in {city}"],
  headline: [
    "A proper cut, a proper shave",
    "Sharp cuts, no fuss",
    "Fresh cut, clean lines",
    "The chair, the clippers, the cut",
  ],
  subheading: [
    "Traditional barbering in {city}, with no fuss and no appointment needed.",
    "Fades, classic cuts and beard work in {city}, done properly and with care.",
    "A barber shop in {city} for a clean cut, a tidy beard and a few minutes off your feet.",
  ],
  servicesHeading: ["What we do", "Services", "On the menu"],
  servicesIntro: ["Classic barbering, done properly.", "Cuts, beards and shaves."],
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
    {
      title: "Fades",
      body: "Skin, low and high fades, blended clean and finished to the line you want.",
    },
    {
      title: "Line-ups",
      body: "Sharp edges around the hairline and beard, to keep a cut looking fresh between visits.",
    },
  ],
  aboutHeading: ["About the shop", "The shop"],
  aboutBody: [
    "{name} is a barber shop in {city}. Straightforward barbering, a decent chair and a conversation if you want one.",
    "At {name} the cut comes first. Tell us what you want, sit back, and leave looking like yourself on a good day.",
    "{name} keeps it simple: good clippers, sharp scissors, hot towels and time taken over every cut.",
  ],
  aboutPoints: [
    "Walk-ins always welcome",
    "Every cut finished properly",
    "A chair and a chat, if you want one",
    "Fades, classics and everything between",
    "Beards shaped to suit your face",
  ],
  galleryHeading: ["The shop", "Fresh cuts"],
  galleryBody: ["A look at the chairs, the shop and a few recent cuts."],
  galleryLabels: ["The shop front", "The chairs", "Recent cut", "Beard work"],
  contactBody: ["Walk in, or call ahead if you would rather have a set time."],
  ctaHeading: ["Ready for a cut?", "Time for a fresh cut", "Your chair is ready"],
  ctaBody: [
    "No appointment needed. Call ahead if you prefer a set time.",
    "Give us a call and we will tell you the best time.",
  ],
  ctaBodyVisit: [
    "No appointment needed. Just come in and take a seat.",
    "Come by, take a seat, and we will be right with you.",
  ],
  footerNote: ["Barber shop in {city}."],
};

const BEAUTY_SALON: CategoryPools = {
  label: null,
  eyebrow: ["Beauty salon in {city}", "Skin and beauty in {city}"],
  headline: [
    "Time to look after yourself",
    "A calm hour, just for you",
    "Skin, brows and a little quiet",
    "Treatments that fit your week",
  ],
  subheading: [
    "Treatments for face, skin and body in a calm salon in {city}.",
    "Facials, waxing, brows and lashes in {city}, in a quiet room and at an unhurried pace.",
    "A beauty salon in {city} where treatments are chosen for your skin, not from a script.",
  ],
  servicesHeading: ["Treatments", "What we offer"],
  servicesIntro: ["A range of treatments, booked around your time.", "Face, body, brows and lashes."],
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
    {
      title: "Makeup",
      body: "Makeup for an event or an evening out, matched to your style and your skin.",
    },
    {
      title: "Body treatments",
      body: "Scrubs and wraps that leave skin soft and properly hydrated.",
    },
  ],
  aboutHeading: ["About the salon", "The salon"],
  aboutBody: [
    "{name} is a beauty salon in {city}. A quiet room, unhurried appointments and treatments chosen to suit you.",
    "At {name} every treatment starts with a few questions about your skin, so what we do suits you and not a routine.",
    "{name} is a calm corner of {city}: a place to switch off for an hour and leave with a lighter step.",
  ],
  aboutPoints: [
    "Appointments to suit your schedule",
    "A calm and private space",
    "Treatments tailored to you",
    "Time for you, never rushed",
    "Advice for your routine at home",
  ],
  galleryHeading: ["The salon", "Inside the salon"],
  galleryBody: ["A look at the treatment rooms and the space."],
  galleryLabels: ["Reception", "Treatment room", "The space", "Details"],
  contactBody: ["Call to book a treatment or to ask what would suit you best."],
  ctaHeading: ["Book a treatment", "Take an hour for yourself", "Your moment of calm"],
  ctaBody: [
    "Call us and we will find an appointment that fits your week.",
    "Give us a call and we will help you choose a treatment.",
  ],
  ctaBodyVisit: [
    "Come in and we will find an appointment that fits your week.",
    "Stop by the salon and we will help you choose a treatment.",
  ],
  footerNote: ["Beauty salon in {city}."],
};

const NAIL_SALON: CategoryPools = {
  label: null,
  eyebrow: ["Nail salon in {city}", "Nails in {city}"],
  headline: [
    "Nails you will keep looking at",
    "Hands worth showing off",
    "A fresh set, done with care",
    "Colour at your fingertips",
  ],
  subheading: [
    "Manicures, pedicures and nail art in {city}, done with care and time.",
    "A nail salon in {city} for everything from a quick tidy-up to a full custom set.",
    "Gel, extensions and nail art in {city}, with every design worked out with you first.",
  ],
  servicesHeading: ["What we do", "Services"],
  servicesIntro: ["From a simple tidy-up to a full set.", "Hands, feet and everything in between."],
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
    {
      title: "Care and repair",
      body: "Strengthening care for nails that break or peel, and repairs for the odd casualty.",
    },
    {
      title: "French and classics",
      body: "Clean French tips and timeless shades, applied neatly and evenly.",
    },
  ],
  aboutHeading: ["About us", "The salon"],
  aboutBody: [
    "{name} is a nail salon in {city}. We take our time, we keep everything clean, and we would rather do one set properly than three in a rush.",
    "At {name} every set starts with a conversation about shape, length and colour, so the result is yours and not ours.",
    "{name} is a careful nail salon in {city}, for hands and feet that deserve a little attention.",
  ],
  aboutPoints: [
    "Time taken over every set",
    "Careful, hygienic practice",
    "Designs worked out with you",
    "Colours for every season",
    "Gentle on your natural nails",
  ],
  galleryHeading: ["Our work", "Recent sets"],
  galleryBody: ["A few recent sets and a look at the salon."],
  galleryLabels: ["Recent set", "Nail art", "The salon", "Colour range"],
  contactBody: ["Call to book, or drop in and we will fit you in if we can."],
  ctaHeading: ["Book your appointment", "Ready for a new set?", "Treat your hands"],
  ctaBody: [
    "Give us a call and tell us what you have in mind.",
    "Call us and we will find you a time.",
  ],
  ctaBodyVisit: [
    "Come in and tell us what you have in mind.",
    "Stop by the salon and we will find you a time.",
  ],
  footerNote: ["Nail salon in {city}."],
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
const TATTOO: CategoryPools = {
  label: null,
  eyebrow: ["Tattoo studio in {city}", "Tattoo and piercing in {city}"],
  headline: [
    "Your idea, drawn properly",
    "Ink worth keeping",
    "Designed with you, made to last",
    "From sketch to skin",
  ],
  subheading: [
    "Custom tattoos and piercing in {city}, designed with you before a needle comes anywhere near.",
    "A tattoo studio in {city} for custom work, flash and honest advice.",
    "Custom pieces, flash and cover-ups in {city}, with every design worked through together.",
  ],
  servicesHeading: ["What we do", "The work"],
  servicesIntro: ["From a first small piece to a full sleeve.", "Custom, flash, cover-ups and piercing."],
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
    {
      title: "Consultations",
      body: "A sit-down before anything is booked, to talk through placement, size and style.",
    },
  ],
  aboutHeading: ["About the studio", "The studio"],
  aboutBody: [
    "{name} is a tattoo studio in {city}. We take the time to get a design right, we keep the studio clean, and we will tell you honestly if an idea is not going to age well.",
    "At {name}, the drawing matters as much as the needle. Bring an idea, a reference or just a feeling, and we will work it into something that suits you.",
    "{name} is a studio in {city} for people who want a tattoo they will still love years from now.",
  ],
  aboutPoints: [
    "Designs worked out with you",
    "Clean, careful practice",
    "Honest advice before anything is booked",
    "Aftercare explained clearly",
    "First tattoos welcome",
  ],
  galleryHeading: ["Our work", "Recent pieces"],
  galleryBody: ["A few recent pieces and a look around the studio."],
  galleryLabels: ["Recent piece", "Fine line work", "The studio", "Flash wall"],
  contactBody: ["Get in touch with your idea, and we will talk it through before anything is booked."],
  ctaHeading: ["Got an idea in mind?", "Let's draw your idea", "Your next piece starts here"],
  ctaBody: [
    "Give us a call and tell us about it. We will talk it through before anything is booked.",
    "Call the studio and tell us what you are imagining.",
  ],
  ctaBodyVisit: [
    "Come by the studio with your idea and we will talk it through.",
    "Stop by with a reference and we will sketch it out together.",
  ],
  footerNote: ["Tattoo studio in {city}."],
};

const RESTAURANT: CategoryPools = {
  label: null,
  eyebrow: ["Restaurant in {city}"],
  headline: ["Come and eat with us"],
  subheading: ["A kitchen in {city} cooking food worth sitting down for."],
  servicesHeading: ["The kitchen"],
  servicesIntro: ["What we cook and how we serve it."],
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
  aboutHeading: ["About us"],
  aboutBody: [
    "{name} is a restaurant in {city}. We cook what we would want to eat, we serve it without ceremony, and we are glad when people stay a while.",
  ],
  aboutPoints: ["Bookings and walk-ins welcome", "Room for larger tables", "Dietary requirements catered for"],
  galleryHeading: ["The place"],
  galleryBody: ["A look at the dining room, the kitchen and a few of the dishes."],
  galleryLabels: ["The dining room", "From the kitchen", "A dish", "The bar"],
  contactBody: ["Call to book a table, or just come in and see if we have room."],
  ctaHeading: ["Book a table"],
  ctaBody: ["Give us a call and tell us when you would like to come."],
  ctaBodyVisit: ["Come and see us. We will find you a table if we can."],
  footerNote: ["Restaurant in {city}."],
};

const CAFE: CategoryPools = {
  label: null,
  eyebrow: ["Cafe in {city}"],
  headline: ["Good coffee, somewhere to sit"],
  subheading: ["A cafe in {city} for a quick coffee, a slow breakfast or an afternoon with a laptop."],
  servicesHeading: ["What we serve"],
  servicesIntro: ["Coffee, food and a place to sit down."],
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
  aboutHeading: ["About the cafe"],
  aboutBody: [
    "{name} is a cafe in {city}. Somewhere to start the morning, break up the afternoon, or sit quietly with a coffee and no particular plan.",
  ],
  aboutPoints: ["Coffee made properly", "Food fresh through the day", "A seat you can keep for a while"],
  galleryHeading: ["The cafe"],
  galleryBody: ["A look at the room, the counter and what comes out of the kitchen."],
  galleryLabels: ["The room", "The counter", "Coffee", "On the plate"],
  contactBody: ["Drop in any time we are open, or call if you want to ask about a larger order."],
  ctaHeading: ["See you soon"],
  ctaBody: ["We are open most of the day. Call ahead for anything large."],
  ctaBodyVisit: ["We are open most of the day. Come in whenever suits you."],
  footerNote: ["Cafe in {city}."],
};

const DENTIST: CategoryPools = {
  label: null,
  eyebrow: ["Dental practice in {city}"],
  headline: ["Dental care without the dread"],
  subheading: ["A dental practice in {city} where things are explained before they are done."],
  servicesHeading: ["Our care"],
  servicesIntro: ["Routine care and treatment, explained clearly."],
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
  aboutHeading: ["About the practice"],
  aboutBody: [
    "{name} is a dental practice in {city}. We explain what we are doing and why, we tell you what it will cost before we start, and we do not rush appointments.",
  ],
  aboutPoints: ["Nervous patients welcome", "Costs explained before treatment", "Appointments that are not rushed"],
  galleryHeading: ["The practice"],
  galleryBody: ["A look at the practice and the surgery."],
  galleryLabels: ["Reception", "The surgery", "Waiting area", "Equipment"],
  contactBody: ["Call to arrange an appointment or to ask about registering with us."],
  ctaHeading: ["Arrange an appointment"],
  ctaBody: ["Call the practice and we will find you a time."],
  ctaBodyVisit: ["Come into the practice and we will find you a time."],
  footerNote: ["Dental practice in {city}."],
};

const PHARMACY: CategoryPools = {
  label: null,
  eyebrow: ["Pharmacy in {city}"],
  headline: ["Your local pharmacy"],
  subheading: ["Prescriptions, advice and everyday health in {city}."],
  servicesHeading: ["What we offer"],
  servicesIntro: ["Prescriptions and advice, without an appointment."],
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
  aboutHeading: ["About the pharmacy"],
  aboutBody: [
    "{name} is a pharmacy in {city}. Somewhere to collect a prescription, ask a straight question, and get a straight answer.",
  ],
  aboutPoints: ["Pharmacist available to talk to", "Repeat prescriptions managed for you", "No appointment needed"],
  galleryHeading: ["The pharmacy"],
  galleryBody: ["A look inside the pharmacy."],
  galleryLabels: ["The counter", "Inside", "Consultation room", "Shelves"],
  contactBody: ["Call with a question, or come in and speak to the pharmacist."],
  ctaHeading: ["We are here to help"],
  ctaBody: ["Call the pharmacy and we will help where we can."],
  ctaBodyVisit: ["Drop in during opening hours and speak to the pharmacist."],
  footerNote: ["Pharmacy in {city}."],
};

const BAKERY: CategoryPools = {
  label: null,
  eyebrow: ["Bakery in {city}"],
  headline: ["Baked fresh, every morning"],
  subheading: ["A bakery in {city} where the day starts early so yours starts better."],
  servicesHeading: ["From the oven"],
  servicesIntro: ["What comes out of the oven each day."],
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
  aboutHeading: ["About the bakery"],
  aboutBody: [
    "{name} is a bakery in {city}. We bake in small batches through the day rather than everything at dawn, which is why things run out and why they taste better.",
  ],
  aboutPoints: ["Baked on site every day", "Whole cakes to order", "The best choice early in the morning"],
  galleryHeading: ["The bakery"],
  galleryBody: ["A look at the counter and what came out of the oven today."],
  galleryLabels: ["The counter", "Fresh bread", "Pastries", "In the bakery"],
  contactBody: ["Drop in, or call ahead for a larger order."],
  ctaHeading: ["Fresh from the oven"],
  ctaBody: ["Call us for a larger order and we will have it ready."],
  ctaBodyVisit: ["Come in and see what is out. Ask in the shop about larger orders."],
  footerNote: ["Bakery in {city}."],
};

const GYM: CategoryPools = {
  label: null,
  eyebrow: ["Gym in {city}"],
  headline: ["Start where you are"],
  subheading: ["A gym in {city} for people who want to train, whatever level they are starting from."],
  servicesHeading: ["Training"],
  servicesIntro: ["Ways to train, whether you like company or quiet."],
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
  aboutHeading: ["About the gym"],
  aboutBody: [
    "{name} is a gym in {city}. Equipment that works, staff who will show you how to use it, and no attitude about where you are starting from.",
  ],
  aboutPoints: ["Beginners genuinely welcome", "Staff on the floor to ask", "Flexible membership terms"],
  galleryHeading: ["The gym"],
  galleryBody: ["A look at the floor, the equipment and the studio."],
  galleryLabels: ["The gym floor", "Free weights", "Studio", "Changing rooms"],
  contactBody: ["Call to ask about membership or to arrange a look around."],
  ctaHeading: ["Take a look around"],
  ctaBody: ["Call us and we will show you the place with no hard sell."],
  ctaBodyVisit: ["Come in and we will show you the place with no hard sell."],
  footerNote: ["Gym in {city}."],
};

const FLORIST: CategoryPools = {
  label: null,
  eyebrow: ["Florist in {city}"],
  headline: ["Flowers for the days that matter"],
  subheading: ["A florist in {city} arranging flowers for occasions large, small and entirely ordinary."],
  servicesHeading: ["What we do"],
  servicesIntro: ["Arrangements for every kind of occasion."],
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
  aboutHeading: ["About the shop"],
  aboutBody: [
    "{name} is a florist in {city}. We buy fresh, we arrange to order, and we will happily tell you what is looking good this week.",
  ],
  aboutPoints: ["Arranged fresh to order", "Local delivery available", "Advice on what is in season"],
  galleryHeading: ["Our arrangements"],
  galleryBody: ["A few recent arrangements and a look at the shop."],
  galleryLabels: ["The shop", "A bouquet", "Wedding flowers", "This week's stems"],
  contactBody: ["Call to order, to arrange delivery, or to talk through an occasion."],
  ctaHeading: ["Order flowers"],
  ctaBody: ["Give us a call and tell us the occasion."],
  ctaBodyVisit: ["Come into the shop and tell us the occasion."],
  footerNote: ["Florist in {city}."],
};

const CAR_REPAIR: CategoryPools = {
  label: null,
  eyebrow: ["Garage in {city}"],
  headline: ["Repairs explained before they happen"],
  subheading: ["A garage in {city} that tells you what is wrong, what it costs, and what can wait."],
  servicesHeading: ["What we do"],
  servicesIntro: ["Servicing and repairs for most makes."],
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
  aboutHeading: ["About the garage"],
  aboutBody: [
    "{name} is a garage in {city}. We tell you what is wrong, what it will cost, and what can safely wait until next time.",
  ],
  aboutPoints: ["Estimates before work starts", "Plain explanations, no jargon", "Most makes and models"],
  galleryHeading: ["The workshop"],
  galleryBody: ["A look at the workshop and the bays."],
  galleryLabels: ["The workshop", "In the bay", "Diagnostics", "The forecourt"],
  contactBody: ["Call to book the car in or to describe a problem and get an idea of cost."],
  ctaHeading: ["Book your car in"],
  ctaBody: ["Call us, describe the problem, and we will tell you what is involved."],
  ctaBodyVisit: ["Bring the car in, describe the problem, and we will tell you what is involved."],
  footerNote: ["Garage in {city}."],
};

/**
 * The fallback for a category with no bespoke content.
 *
 * Deliberately vaguer than the entries above. A category we have not written
 * for gets copy that could sit under any trade, because guessing at the
 * specifics of a business type we have not thought about is exactly how an
 * invented specific reaches a page.
 */
export const GENERIC_EN: CategoryPools = {
  label: null,
  eyebrow: ["{city}"],
  headline: ["Welcome to {name}"],
  subheading: ["Serving customers in {city}."],
  servicesHeading: ["What we do"],
  servicesIntro: ["The main things we can help with."],
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
  aboutHeading: ["About us"],
  aboutBody: ["{name} is based in {city}. A short introduction to the business would go here."],
  aboutPoints: ["Local to {city}", "Straightforward to deal with", "Happy to answer questions"],
  galleryHeading: ["Gallery"],
  galleryBody: ["A few photographs of the business."],
  galleryLabels: ["Photograph", "Photograph", "Photograph", "Photograph"],
  contactBody: ["Get in touch and we will be glad to help."],
  ctaHeading: ["Get in touch"],
  ctaBody: ["We would be glad to hear from you."],
  ctaBodyVisit: ["Come and see us. We would be glad to help."],
  footerNote: ["Based in {city}."],
};

export const POOLS_EN: Readonly<Record<string, CategoryPools>> = {
  "hair-salon": HAIR_SALON,
  barber: BARBER,
  "beauty-salon": BEAUTY_SALON,
  "nail-salon": NAIL_SALON,
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
