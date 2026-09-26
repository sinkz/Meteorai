# Hollow Reliquary

A dark match-3 for phones. Six relics lie shattered in a crypt. Their fragments are
locked under cursed seals on the board. Match gems on a seal to break it, and the
jigsaw fragment it holds flies up and snaps into the relic. Restore the whole relic
before your moves run out.

## Run it

The game is plain ES modules, so it needs to be served over HTTP (opening the file
directly will not load the modules):

```bash
python3 -m http.server 8080 --directory game
# then open http://localhost:8080 (use your LAN IP to play on a phone)
```

## Play

| Shape | Creates | Effect |
| --- | --- | --- |
| 3 in a line | — | Clears the gems |
| 4 in a line | Blaster | Sears its whole row (horizontal match) or column (vertical match) |
| L or T | Hex | Bursts the 3×3 around it |
| 5 in a line | Void Eye | Swap with a gem to erase every gem of that color |

Swapping two specials combines them: Crucifix (two Blasters), Pentacle
(Hex + Blaster), Cataclysm (two Hexes), Contagion (Void Eye + a special turns
every gem of that color into that special) and Oblivion (two Void Eyes).

Moves left when the relic is restored become Blasters in the Requiem finale.
Stars depend on how many moves you save.

## Code

| File | Role |
| --- | --- |
| `engine.js` | Pure, seedable match-3 rules. Returns step descriptions for animation. |
| `levels.js` | The six relics, star rating, saved progress and jigsaw geometry. |
| `art.js` | Procedural gem sprites, relic paintings and the jigsaw cutter. |
| `audio.js` | Every sound effect, synthesized with WebAudio. |
| `main.js` | Rendering, particles, screen shake, input and game flow. |

`engine.js` and `levels.js` are covered by `test/game-engine.test.js` and
`test/game-levels.test.js` (`npm test`). The canvas, audio and input layers are
checked by playing, since they have no logic that the engine doesn't already own.
