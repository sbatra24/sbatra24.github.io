# soham-batra-site

Personal site. One self-contained `index.html`: photos, fonts, CSS and JS are all
inlined, so there is nothing to build and nothing to break.

## Publishing

Push, then Settings > Pages > Deploy from a branch > `main` > `/ (root)`.
Live a minute later at `https://sbatra24.github.io/soham-batra-site/`.

For a custom domain, add a `CNAME` file containing the domain and point an ALIAS
or four A records at GitHub Pages.

## Editing

Everything is in the one file.

- **Pages** are `<section id="p-home">`, `p-publications`, `p-awards`,
  `p-interests`, `p-photos`. The nav buttons at the top switch between them.
- **Music** is the `.mu` block. Each button is
  `<button data-v="YOUTUBE_ID"><span>Title</span><em>Artist</em></button>`.
  Swap a song by replacing the id and the two labels.
- **Photos** live in the `IMG` array at the top of the `<script>` as base64
  strings. Each `.strip` picks which ones it shows with `data-ph="0,8,3,10"` and
  how many columns with `data-c`.
- **The tidy/messy slider** on the Photos page sets the `--m` custom property,
  which drives the rotation and shadow on every photo.

## Note

The file is about 2.2 MB because the images are embedded. That is fine for Pages
and loads quickly. If you ever want it smaller, pull the base64 strings out into
an `img/` folder and swap the array for file paths.
