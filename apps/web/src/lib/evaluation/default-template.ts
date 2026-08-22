/**
 * THE platform basketball template, inherited by every club (owner
 * 2026-08-21). A club may disable a category, reweight it, or add its own.
 * It may never delete a base one, because the base is what stays comparable
 * across clubs and across years, and that comparability is the whole basis of
 * checking a September rating against February's real stat line later.
 *
 * THE ANCHORS ARE THE POINT. An unanchored 1-5 means one coach's 4 is
 * another's 2, and averaging those produces noise that looks authoritative.
 * Every anchor below is written as an OBSERVABLE behaviour a coach can see in
 * one rep, not as a judgement ("good", "average") that each evaluator scales
 * differently in their own head.
 *
 * Categories and their descriptions follow the standard set the research
 * found across every source (docs/research/tryout-evaluation-2026-08.md):
 * eight skills, then the intangibles that actually decide most cuts.
 */

export interface TemplateCategory {
  key: string
  label: string
  hint: string
  weight: number
  anchors: Record<"1" | "2" | "3" | "4" | "5", string>
}

export interface TemplateMeasurable {
  key: string
  label: string
  unit: string
  higherIsBetter: boolean
}

export const DEFAULT_TEMPLATE_NAME = "Basketball tryout (standard)"

export const DEFAULT_CATEGORIES: TemplateCategory[] = [
  {
    key: "shooting",
    label: "Shooting",
    hint: "Form, footwork, release, and shot selection under pressure",
    weight: 1.25,
    anchors: {
      "1": "Shot mechanics break down. Little arc or rotation, misses well short or long",
      "2": "Repeatable form standing still, but it falls apart off the catch or with a hand up",
      "3": "Consistent form and feet set. Makes open catch-and-shoot from mid range",
      "4": "Shoots off the catch and off the dribble. Holds form with a defender closing",
      "5": "Range past the arc with a hand in their face. Feet, balance and release do not change",
    },
  },
  {
    key: "ball_handling",
    label: "Ball handling",
    hint: "Tight dribbles, both hands, head up at game speed",
    weight: 1.25,
    anchors: {
      "1": "Loses the ball under light pressure. Eyes down, dominant hand only",
      "2": "Controls it walking, but the dribble rises and the head drops at speed",
      "3": "Handles pressure with both hands and keeps their head up in the open floor",
      "4": "Changes hands and pace under real pressure without slowing the offence",
      "5": "Cannot be sped up. Breaks pressure and creates for others while doing it",
    },
  },
  {
    key: "defense",
    label: "Defense",
    hint: "Stance, feet, on-ball pressure, help-side, and talk",
    weight: 1.25,
    anchors: {
      "1": "Upright and flat-footed. Ball-watching, does not rotate",
      "2": "Tries on the ball, but stands up when tired and is late helping",
      "3": "Stays in a stance, moves their feet on the ball, rotates when told",
      "4": "Contains without fouling, helps early, and talks in transition",
      "5": "Takes the other team's best player. Directs the defence out loud",
    },
  },
  {
    key: "passing",
    label: "Passing",
    hint: "Accuracy, vision, timing, and the right read",
    weight: 1,
    anchors: {
      "1": "Forces passes into traffic or does not look up at all",
      "2": "Makes the obvious pass late, or on time but off target",
      "3": "Hits the open teammate on time and in the shooting pocket",
      "4": "Reads the second defender and passes ahead in transition",
      "5": "Creates shots for others. Sees the play one pass before it exists",
    },
  },
  {
    key: "finishing",
    label: "Layups and finishing",
    hint: "Footwork, body control, both hands, and through contact",
    weight: 1,
    anchors: {
      "1": "Wrong footwork, misses uncontested layups",
      "2": "Finishes on the strong side only, avoids contact",
      "3": "Correct footwork both sides, finishes uncontested at speed",
      "4": "Finishes with either hand and absorbs contact",
      "5": "Changes angle or hand in the air and still finishes through a body",
    },
  },
  {
    key: "off_dribble",
    label: "Creating off the dribble",
    hint: "Change of pace, change of direction, separation",
    weight: 1,
    anchors: {
      "1": "No move. Picks the ball up when the defender stays in front",
      "2": "One move to one side, and only when there is space",
      "3": "Beats a defender straight-line with a change of pace",
      "4": "Counters when the first move is cut off, and stays under control",
      "5": "Gets any angle they want and reads what the help does next",
    },
  },
  {
    key: "rebounding",
    label: "Rebounding",
    hint: "Box out, urgency, position on both glasses",
    weight: 1,
    anchors: {
      "1": "Watches the shot. No contact, no pursuit",
      "2": "Boxes out when told, but does not chase the ball",
      "3": "Finds a body and pursues on the defensive glass",
      "4": "Boxes out consistently and goes to the offensive glass too",
      "5": "Rebounds outside their area and starts the break with the outlet",
    },
  },
  {
    key: "free_throws",
    label: "Free throws",
    hint: "Whether they go in, and whether the routine repeats",
    weight: 0.75,
    anchors: {
      "1": "Under 40%. Routine and form change shot to shot",
      "2": "Around 50%. Same routine some of the time",
      "3": "Around 65%. Repeatable routine",
      "4": "Around 75%. Same routine and release every time, tired or not",
      "5": "Over 85%. Automatic, and unaffected by the score",
    },
  },
  {
    key: "coachability",
    label: "Coachability",
    hint: "Does a correction stick on the very next rep",
    weight: 1.5,
    anchors: {
      "1": "Argues, sulks, or repeats the same mistake after being told",
      "2": "Takes the note but needs it several times",
      "3": "Applies a correction on the next rep",
      "4": "Applies it and holds it for the rest of the session",
      "5": "Asks for the correction, then coaches a teammate through it",
    },
  },
  {
    key: "compete",
    label: "Effort and compete",
    hint: "Motor, and what happens when they are tired or losing",
    weight: 1.5,
    anchors: {
      "1": "Jogs back. Gives up on plays that look lost",
      "2": "Goes hard in drills, coasts in the scrimmage",
      "3": "Sprints the floor both ways for the whole session",
      "4": "Dives, takes charges, chases plays nobody expects them to get",
      "5": "Raises the level of the group. The gym is louder and faster with them in it",
    },
  },
  {
    key: "basketball_iq",
    label: "Basketball IQ",
    hint: "Spacing, decisions, reading the play",
    weight: 1.25,
    anchors: {
      "1": "Stands in the wrong place and does not know where the ball should go",
      "2": "Knows their job once reminded, but does not adjust",
      "3": "Spaces correctly and makes the simple right decision",
      "4": "Reads the defence and makes the second-best option work",
      "5": "Anticipates two actions ahead and organises teammates around it",
    },
  },
  {
    key: "communication",
    label: "Communication",
    hint: "Talking on defence, calling screens, leading",
    weight: 1,
    anchors: {
      "1": "Silent all session",
      "2": "Speaks only when spoken to",
      "3": "Calls out screens and switches",
      "4": "Talks constantly on defence and directs teammates",
      "5": "Runs the huddle. Others look to them before the coach speaks",
    },
  },
]

/**
 * Objective. No rubric, no evaluator bias, and comparable across years, which
 * makes these the cheapest thing here and the only layer trustworthy without
 * anchoring. Names follow what the station-based tryout research found.
 */
export const DEFAULT_MEASURABLES: TemplateMeasurable[] = [
  { key: "lane_agility", label: "Lane agility", unit: "seconds", higherIsBetter: false },
  { key: "sprint_three_quarter", label: "3/4 court sprint", unit: "seconds", higherIsBetter: false },
  { key: "suicides", label: "Suicides / 17s", unit: "seconds", higherIsBetter: false },
  { key: "ft_made_10", label: "Free throws made", unit: "of 10", higherIsBetter: true },
  { key: "spot_shooting_made", label: "Spot shooting made", unit: "of 25", higherIsBetter: true },
  { key: "vertical", label: "Vertical jump", unit: "inches", higherIsBetter: true },
  { key: "height", label: "Height", unit: "cm", higherIsBetter: true },
]
