# sbatra24.github.io

Personal site, live at https://sbatra24.github.io. One self-contained `index.html`:
photos, font, CSS and JS are all inlined. Nothing to build.

## Editing

- Pages are the `<section id="p-...">` blocks: home, publications, awards, interests, photos.
  The nav buttons at the top switch between them.
- Music is the `.mu` block. Each button is
  `<button data-v="YOUTUBE_ID"><span>Title</span><em>Artist</em></button>`.
- Photos are base64 strings in the `IMG` array at the top of the `<script>`. Each `.strip`
  picks which ones to show with `data-ph="0,8,3,10"` and how many columns with `data-c`.
- The tidy/messy slider on the Photos page sets `--m`, which drives rotation and shadow on
  every photo.

## Publishing

Push to `main`. GitHub Pages serves the root of the repo, so the change is live within a
minute or two.
