# Default PEG Parser for Gutenberg

The current default parser in Gutenberg runs identically to the spec
parser _when the document is valid_ but when there are parse failures
the behaviors differ. This is due to the fact that the default parser
isn't truly implementing a Parsing Expression Grammar.

This new code is my exploration to learn how to code up a PEG parser
by hand. Expect some naive code.

## Developing

After cloning the repo run `npm install` then `npm run test:watch`.
