import { type ChatMessage } from "./mock-data";

// Pre-baked WhatsApp-style transcripts between the customer and the AI booking agent.
// Keyed by case id.
export const seedChats: Record<string, ChatMessage[]> = {
  "CASE-2041": [
    { id: "1", from: "customer", text: "Hey, my Camry's brakes have been squealing pretty badly the last few days 😬", at: "2025-05-26T09:12:00Z" },
    { id: "2", from: "ai", text: "Hi Alex! Sorry to hear that. Can you tell me — is the squealing happening all the time, or only when braking?", at: "2025-05-26T09:12:30Z" },
    { id: "3", from: "customer", text: "Mostly when I press the brakes, especially at low speed", at: "2025-05-26T09:13:10Z" },
    { id: "4", from: "ai", text: "Got it. That usually points to worn brake pads. Have you noticed any vibration in the pedal or steering wheel when braking?", at: "2025-05-26T09:13:40Z" },
    { id: "5", from: "customer", text: "A little vibration sometimes yeah", at: "2025-05-26T09:14:20Z" },
    { id: "6", from: "ai", text: "Thanks. I'd recommend a brake inspection — we'll check the pads and rotors. Want me to book you in?", at: "2025-05-26T09:14:50Z" },
    { id: "7", from: "customer", text: "Yes please. Earliest slot?", at: "2025-05-26T09:15:10Z" },
    { id: "8", from: "ai", text: "We have Wednesday at 10:00 AM with Rico. Does that work?", at: "2025-05-26T09:15:30Z" },
    { id: "9", from: "customer", text: "Perfect, book it 👍", at: "2025-05-26T09:15:55Z" },
    { id: "10", from: "ai", text: "Booked! ✅ You'll get a confirmation shortly. See you Wednesday at 10 AM.", at: "2025-05-26T09:16:10Z" },
  ],
  "CASE-2042": [
    { id: "1", from: "customer", text: "Need an oil change for the CR-V", at: "2025-05-28T14:02:00Z" },
    { id: "2", from: "ai", text: "Hi Alex! Sure. When was your last oil change?", at: "2025-05-28T14:02:20Z" },
    { id: "3", from: "customer", text: "About 4 months ago, ~5500 miles", at: "2025-05-28T14:03:00Z" },
    { id: "4", from: "ai", text: "Perfect timing. Want me to add a tire rotation while it's in?", at: "2025-05-28T14:03:30Z" },
    { id: "5", from: "customer", text: "Yeah good idea", at: "2025-05-28T14:03:50Z" },
    { id: "6", from: "ai", text: "Great. Earliest slot is tomorrow at 9 AM with Dana. Confirm?", at: "2025-05-28T14:04:15Z" },
    { id: "7", from: "customer", text: "Confirmed 🙏", at: "2025-05-28T14:04:30Z" },
    { id: "8", from: "ai", text: "Done! See you tomorrow at 9 AM.", at: "2025-05-28T14:04:45Z" },
  ],
  "CASE-2043": [
    { id: "1", from: "customer", text: "My F-150 has been slipping in 3rd gear when I accelerate hard", at: "2025-05-27T16:40:00Z" },
    { id: "2", from: "ai", text: "Hi Jamie. That sounds like a transmission issue. How long has this been going on?", at: "2025-05-27T16:40:25Z" },
    { id: "3", from: "customer", text: "About two weeks. Getting worse", at: "2025-05-27T16:41:00Z" },
    { id: "4", from: "ai", text: "Any warning lights on the dash?", at: "2025-05-27T16:41:20Z" },
    { id: "5", from: "customer", text: "Nope nothing yet", at: "2025-05-27T16:41:40Z" },
    { id: "6", from: "ai", text: "Okay. We'll need to run a transmission diagnostic. I'd recommend bringing it in soon — driving on a slipping transmission can cause more damage.", at: "2025-05-27T16:42:10Z" },
    { id: "7", from: "customer", text: "Can I bring it tomorrow?", at: "2025-05-27T16:42:30Z" },
    { id: "8", from: "ai", text: "Yes — Sam has a slot at 8 AM. Booked you in. Drive carefully until then 🙏", at: "2025-05-27T16:43:00Z" },
  ],
  "CASE-2044": [
    { id: "1", from: "customer", text: "Truck won't start this morning. Clicking sound", at: "2025-05-20T07:30:00Z" },
    { id: "2", from: "ai", text: "Hi Jamie. Clicking with no start usually means the battery. Lights dim when you turn the key?", at: "2025-05-20T07:30:20Z" },
    { id: "3", from: "customer", text: "Yeah very dim", at: "2025-05-20T07:30:40Z" },
    { id: "4", from: "ai", text: "Sounds like a dead battery. We can swap it today if you can get a jump and drive it over.", at: "2025-05-20T07:31:00Z" },
    { id: "5", from: "customer", text: "On my way", at: "2025-05-20T07:31:20Z" },
    { id: "6", from: "ai", text: "Great. Rico will have a fresh 12V H7 ready. See you soon.", at: "2025-05-20T07:31:40Z" },
  ],
  "CASE-2045": [
    { id: "1", from: "customer", text: "AC in the CR-V is barely blowing cold", at: "2025-05-30T11:00:00Z" },
    { id: "2", from: "ai", text: "Hi Alex! Is it blowing warm, or just weak airflow?", at: "2025-05-30T11:00:20Z" },
    { id: "3", from: "customer", text: "Weak airflow and not very cold", at: "2025-05-30T11:00:45Z" },
    { id: "4", from: "ai", text: "Could be low refrigerant or a clogged cabin filter. We can do a recharge + inspection. Want me to schedule it?", at: "2025-05-30T11:01:10Z" },
    { id: "5", from: "customer", text: "Yes please", at: "2025-05-30T11:01:25Z" },
    { id: "6", from: "ai", text: "Booked for tomorrow morning. Thanks Alex 👍", at: "2025-05-30T11:01:50Z" },
  ],
};

export const seedChatSummaries: Record<string, string> = {
  "CASE-2041": "AutoCranker AI captured that Alex’s Camry has brake squeal mainly at low speeds, with occasional vibration through the pedal or steering wheel. The symptoms point to worn pads and possible rotor involvement, so the AI recommended a brake inspection rather than continued driving. Alex accepted the earliest appointment, and the visit was booked for Wednesday at 10:00 AM with Rico.",
  "CASE-2042": "AutoCranker AI confirmed Alex needs routine maintenance on the CR-V after roughly 5,500 miles since the last oil change. The AI also suggested a tire rotation while the vehicle is already in the shop, which the customer approved. The conversation ended with a confirmed appointment for tomorrow at 9:00 AM with Dana and no urgent drivability concerns noted.",
  "CASE-2043": "AutoCranker AI noted Jamie’s F-150 is slipping in 3rd gear during hard acceleration and that the issue has worsened over two weeks without warning lights. The AI flagged this as a likely transmission concern and warned that continued driving could cause additional damage. Jamie asked for the next available time, and Sam’s 8:00 AM diagnostic slot was booked for the next day.",
  "CASE-2044": "AutoCranker AI identified the truck’s no-start condition as likely battery-related after Jamie described clicking and very dim lights. The customer was advised to get a jump start and drive in for same-day service if safe to do so. Rico was assigned to prepare a replacement 12V H7 battery, so the shop can move quickly once the vehicle arrives.",
  "CASE-2045": "AutoCranker AI captured that Alex’s CR-V has weak airflow and poor cooling from the AC system. The symptoms suggest either low refrigerant, a clogged cabin filter, or a related AC performance issue that needs inspection. The AI recommended a recharge plus diagnostic check, and Alex accepted the next available morning appointment for service.",
};

export type { ChatMessage };
