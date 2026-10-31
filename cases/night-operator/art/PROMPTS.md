# Art prompts: The Night Operator

Generate each image with any AI image tool and save it in this folder under the exact filename given. The game loads whichever files exist and draws a placeholder for the rest, so you can add them one at a time.

**Every prompt starts with the same style block.** Keep it word for word so all 18 images match.

> **STYLE:** 1940s film-noir illustration, painted gouache on textured paper, ink blue-black shadows, warm amber key light from one side, brass highlights, muted desaturated palette, subtle film grain, cinematic, no text, no lettering, no watermark

## Characters (14 images)

Format for all characters: **waist-up, three-quarter view facing the viewer, plain transparent background (or flat solid grey if your tool can't do transparency), 1024x1536 portrait.** For the three expressions, keep the same seed or reference image so the face, clothes and framing stay identical; only the expression and posture change.

### Frank Doyle: night manager of the Hotel Marlowe (the smooth one)
Base: *STYLE. Portrait of a man in his late 40s, slicked-back dark hair with grey temples, thin moustache, immaculate three-piece charcoal suit, carnation in lapel, holding a cigarette, hotel night manager, 1947.*
- `doyle-calm.png`: base + *confident half-smile, chin up, relaxed, smoke curling.*
- `doyle-uneasy.png`: base + *smile tight and forced, eyes narrowed, cigarette held stiffly.*
- `doyle-cracking.png`: base + *jaw clenched, sweat on brow, tie slightly loosened, glaring, cigarette crushed in fingers.*

### Evelyn Ashford: society widow (the bored aristocrat)
Base: *STYLE. Portrait of an elegant woman in her 50s, wide-brimmed black hat with a short net veil, pearl necklace, black silk evening dress with fur stole, holding a cocktail glass, wealthy widow, 1947.*
- `evelyn-calm.png`: base + *bored, heavy-lidded amused look, glass raised lazily.*
- `evelyn-uneasy.png`: base + *lips pressed thin, glancing sideways, fingers on pearls.*
- `evelyn-cracking.png`: base + *veil pushed up, eyes glistening, glass trembling, composure breaking.*

### Leo Brandt: crime reporter at the Herald (the wisecracker)
Base: *STYLE. Portrait of a lean man in his 30s, battered fedora with a PRESS card tucked in the band, loosened tie, rumpled shirt with sleeves rolled, pencil behind ear, notepad in hand, newspaper reporter, 1947.*
- `leo-calm.png`: base + *cocky crooked grin, eyebrow raised.*
- `leo-uneasy.png`: base + *grin gone, rubbing the back of his neck, guarded eyes.*
- `leo-cracking.png`: base + *hat pushed back, red-rimmed grieving eyes, jaw tight, notepad crumpled.*

### Officer Tom Riley: beat cop, Dot's ex-fiancé (the big, angry one)
Base: *STYLE. Portrait of a big broad-shouldered man in his 30s, 1940s police officer's peaked cap with badge, dark wool police uniform coat with brass buttons, square jaw, stubble, beat cop, 1947.*
- `riley-calm.png`: base + *arms crossed, stern and defensive, guarded stare.*
- `riley-uneasy.png`: base + *scowling, cap pushed back, looking away.*
- `riley-cracking.png`: base + *eyes wet with angry grief, fist clenched, leaning forward.*

### Mrs. Hale: operator supervisor and narrator
- `hale.png`: *STYLE. Portrait of a kind but sharp woman in her 60s, silver hair in a neat 1940s roll, wire spectacles, cardigan over a high-collared blouse, telephone operator headset around her neck, warm knowing look, telephone exchange supervisor, 1947.*

### Dot Kowalski: the victim (pinned photo in the evidence close-up)
- `dot.png`: *STYLE. Faded black-and-white studio photograph of a cheerful young woman in her 20s, 1940s victory-roll hair, telephone operator headset, bright smile, slightly creased photo print with a white border.*

## Backdrops (4 images)

Format: **landscape 1920x1080, no people.**

- `bg-exterior.png`: *STYLE. Exterior of a 1940s brick telephone exchange building at 2 a.m. in the rain, one lit window on the second floor, wet street reflecting a streetlamp, a hotel neon sign across the street, empty sidewalk, low angle.*
- `bg-interior.png`: *STYLE. Interior of a 1940s telephone exchange at night, long switchboard with rows of jacks and small glowing amber lamps, one empty operator's chair pushed back, a headset dangling, desk lamp, dark room, rain on the window.*
- `bg-cord.png`: *STYLE. Extreme close-up of a brass-tipped telephone switchboard patch cord hanging loose from a jack panel, shallow depth of field, amber lamp glow, dramatic shadows.*
- `bg-log.png`: *STYLE. Close-up of an open handwritten operator's call log on a wooden desk, pencil, coffee cup ring, desk lamp light, the lines of handwriting illegible and blurred.*

When your tool can't do transparent backgrounds, generate on flat grey and remove the background (for example with remove.bg or Photoshop's "Remove background"), then save as PNG.
