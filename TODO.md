TODO:

implement from bandcamp extension suite:

1. Advanced Mouse Playbar
Let's start by implementing the advanced mouse playbar functionality that allows clicking anywhere on the playbar to set the playhead position.  This should work on both the wishlit player, and track/album page players.

2. Waveform Display
Adds a wavform display similar to visualization of Soundcloud. A toggle below the "play button" on album pages will enable/disable the display. Note: The waveform is processed browserside.

3. BPM Estimate
Adds a BPM estimate for tracks played on Album or Track page. Note: The bpm estimation is processed browserside.

3. Bundle Purchase Download Button
Adds a button to help automate the process of download a cart after purchase. Once all music download links are ready this button, when clicked, generate a .txt file which can be pasted into terminal to automate the downloading process. This .txt file uses cURL.

Additionally, while the generated file is a .txt, it can be run directly in terminal with the command:

. ./bandcamp_*.txt
This will download the files into the same directory the terminal session is in.

finally,
add 'b' hotkey on wishlist page to add directly to cart at suggested price.  if there is no suggested price, add at minimum price