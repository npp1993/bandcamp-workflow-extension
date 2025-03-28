TODO:



Additionally, while the generated file is a .txt, it can be run directly in terminal with the command:

. ./bandcamp_*.txt
This will download the files into the same directory the terminal session is in.


new feature, not referenced in any existing plugins:
add 'b' hotkey on wishlist page to add directly to cart at suggested price.  if there is no suggested price, add at minimum price
add 'v' hotkey on wishist page to add all items in wishlist to cart

implement from bandcamp extension suite:

I'd like to implement the following feature:

Waveform Display
Adds a waveform display for the currently playing track that corresponds to the amplitude of a track over time.  display this waveform directly below the play bar. the user should be able to click into the waveform to seek around the track, similar as to the play bar.  this only should be implemented on release pages.

I've copied code from an existing, separate chrome extension that has this exact functionality into the BandcampEnhancementSuite/ folder i've also added into your context.

feel free to copy or reference code from the existing implementation.  FYI that we will delete this directory when we are done using it to implement our own features in our own extension
