# NSpeedReader

NSpeedReader is a browser-based speed reading tool. It displays text in short word groups, adjusts pacing around punctuation and semantic breaks, and gives readers controls for speed, text style, color, and focus-letter highlighting.

The interface is currently written in Turkish.

You may try it on https://nspeedreader.engin.net.tr/ 

## Features

- Paste or edit any source text directly in the reader.
- Play, pause, reset, move backward, move forward, or scrub through the text with the position slider.
- Set the base reading speed from 80 to 900 words per minute.
- Choose 1-word, 2-word, 3-word, or automatic word grouping.
- Add comprehension-aware pauses for long phrases, punctuation, sentence endings, and idea transitions.
- Highlight a focus letter inside each word to help eye alignment.
- Switch between system, serif, mono, and dyslexia-friendly font stacks.
- Adjust reader font size from 36 px to 128 px.
- Use preset themes or choose custom background, text, and focus colors.
- View word count, estimated duration, chunk count, progress, and current pause duration.
- Use keyboard shortcuts outside form fields:
  - Space: play or pause
  - Left Arrow: previous chunk
  - Right Arrow: next chunk

## Installation

No build step or package installation is required. This is a static HTML, CSS, and JavaScript project.

To run it locally, open `public/index.html` in a browser.

You can also serve the `public` folder with any static file server. For example:

```sh
python3 -m http.server 8000 --directory public
```

Then open:

```text
http://localhost:8000
```

## Project Structure

```text
.
├── public/
│   ├── index.html    # App markup and controls
│   ├── styles.css    # Responsive layout and theme styling
│   └── app.js        # Reading logic, pacing, controls, and rendering
├── wrangler.jsonc    # Cloudflare Workers static assets config
└── README.md         # Project documentation
```

## Usage

1. Open the app in a browser.
2. Paste or type text into the Metin field.
3. Choose a base speed and group size.
4. Adjust comprehension pauses, typography, and colors as needed.
5. Press Oynat or the Space key to start reading.

## Notes

- All processing happens in the browser.
- The app does not send text to a server.
- Custom colors are applied immediately when edited.
- Duration is an estimate based on the selected speed and pause settings.

## License

No license has been added yet. Add a license file before reuse or distribution if you want to define public usage terms.
