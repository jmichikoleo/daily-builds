// src/games/registry.ts
// the list of games. adding a game means adding one entry here, nothing in the engine changes.

import type { GameDefinition } from "../engine/types";
import StarCatcher from "./star-catcher/StarCatcher";
import PanicButton from "./panic-button/PanicButton";
import FrogTraffic from "./frog-traffic/FrogTraffic";
import WrongDelivery from "./wrong-delivery/WrongDelivery";
import GardenEmergency from "./garden-emergency/GardenEmergency";
import GhostHunt from "./ghost-hunt/GhostHunt";
import {
  FrogTrafficThumb,
  GardenEmergencyThumb,
  GhostHuntThumb,
  PanicButtonThumb,
  StarCatcherThumb,
  WrongDeliveryThumb,
} from "./thumbnails";

export const GAMES: readonly GameDefinition[] = [
  {
    id: "star-catcher",
    title: "Star Catcher",
    description: "catch falling stars before they disappear",
    objective: "catch the good stars. dodge the grumpy red ones.",
    controls: ["arrow keys or a and d", "or move the mouse", "or drag on a touch screen"],
    tip: "rainbow stars fall fast. it is worth the lunge.",
    difficulty: 1,
    theme: { bg: "#1d1240", accent: "#ffd23f", ink: "#2b2340" },
    scoring: { rules: ["golden star +10", "blue star with a ring +25", "spiky red star -15", "rainbow star +50"], good: 450, great: 900 },
    messages: {
      low: ["the stars would like to apologise. they will not.", "You were doing so well. Allegedly.", "the basket believes in you. mostly."],
      mid: ["One minute of questionable decisions.", "a respectable amount of sky in a basket.", "That was almost impressive."],
      high: ["you caught a frankly unreasonable number of stars.", "the night sky is filing for a refund.", "Again? Of course again."],
    },
    Thumbnail: StarCatcherThumb,
    Component: StarCatcher,
  },
  {
    id: "panic-button",
    title: "Panic Button",
    description: "keep an absurd machine from exploding",
    objective: "keep heat, pressure and power in the green zone.",
    controls: ["hold cool or press and hold q", "toggle the valve or press w", "tap reset or press e"],
    tip: "the valve keeps venting while open. close it before pressure drops too low.",
    difficulty: 3,
    theme: { bg: "#ffe8c2", accent: "#ff5a5f", ink: "#2b2340" },
    scoring: { rules: ["all three green +12 a second", "rescue a red gauge +25", "perfect streak bonus every 5s", "red gauges -4 a second each"], good: 500, great: 1000 },
    messages: {
      low: ["the machine is fine. the machine is not fine.", "Your reflexes have filed a complaint.", "please do not tell the warranty people."],
      mid: ["mostly not on fire. good job.", "One minute of questionable decisions.", "the machine has decided to trust you. for now."],
      high: ["engineers everywhere are taking notes.", "calm hands, sweaty machine.", "Again? Of course again."],
    },
    Thumbnail: PanicButtonThumb,
    Component: PanicButton,
  },
  {
    id: "frog-traffic",
    title: "Frog Traffic",
    description: "help a frog hop across drifting lily pads",
    objective: "hop across the pond. do not take a swim.",
    controls: ["arrow keys or w a s d", "or the big arrow buttons"],
    tip: "you can wait on a pad. just do not ride it off the edge.",
    difficulty: 2,
    theme: { bg: "#6cc7b6", accent: "#4fae5a", ink: "#2b2340" },
    scoring: { rules: ["new lily pad row +5", "reach the far bank +40 and more each level", "falling in sends you back"], good: 200, great: 450 },
    messages: {
      low: ["the frog is damp but optimistic.", "You were doing so well. Allegedly.", "ribbit. that means try again."],
      mid: ["a frog of moderate renown.", "That was almost impressive.", "the lily pads respect you now."],
      high: ["legendary frog behaviour.", "the pond will tell stories about this.", "Again? Of course again."],
    },
    Thumbnail: FrogTrafficThumb,
    Component: FrogTraffic,
  },
  {
    id: "wrong-delivery",
    title: "Wrong Delivery",
    description: "sort bizarre packages before they fall off the belt",
    objective: "send every package to the right door.",
    controls: ["press 1, 2 or 3", "or click or tap the doors"],
    tip: "every box has a sticker. the sticker never lies. combos get big fast.",
    difficulty: 2,
    theme: { bg: "#ffd9e6", accent: "#4aa8ff", ink: "#2b2340" },
    scoring: { rules: ["right door +10 times combo", "wrong door -5", "missed package -3", "every 5 in a row raises the combo"], good: 350, great: 800 },
    messages: {
      low: ["someone is going to get a very confusing parcel.", "Your reflexes have filed a complaint.", "the conveyor belt would like a word."],
      mid: ["mostly the right doors. mostly.", "One minute of questionable decisions.", "a perfectly average day at the toy factory."],
      high: ["employee of the minute.", "every parcel home safe. even the weird one.", "Again? Of course again."],
    },
    Thumbnail: WrongDeliveryThumb,
    Component: WrongDelivery,
  },
  {
    id: "garden-emergency",
    title: "Garden Emergency",
    description: "keep a tiny garden alive for one minute",
    objective: "water, weed and help the flowers bloom.",
    controls: ["pick a tool with 1, 2 or 3", "click or tap a plot", "arrow keys and enter work too"],
    tip: "buds wait a while for sun. thirsty plants do not.",
    difficulty: 1,
    theme: { bg: "#dff5c9", accent: "#3ccf91", ink: "#2b2340" },
    scoring: { rules: ["sun on a bud to bloom +20", "save a thirsty plant +10", "pull a weed +5", "wilted plants stop scoring"], good: 300, great: 600 },
    messages: {
      low: ["the garden is mostly weeds and vibes.", "You were doing so well. Allegedly.", "the tomatoes saw everything."],
      mid: ["a garden with real potential.", "That was almost impressive.", "the butterflies approve, cautiously."],
      high: ["you have the greenest of thumbs.", "a minute of pure horticulture.", "Again? Of course again."],
    },
    Thumbnail: GardenEmergencyThumb,
    Component: GardenEmergency,
  },
  {
    id: "ghost-hunt",
    title: "Ghost Hunt",
    description: "spot the mischievous ghosts hiding in a haunted room",
    objective: "tap ghosts with faces. leave the faceless laundry alone.",
    controls: ["click or tap a ghost", "or tab to a hiding spot and press enter"],
    tip: "real ghosts have eyes. sheets on a chair do not.",
    difficulty: 2,
    theme: { bg: "#d9d2f7", accent: "#8b5cf6", ink: "#2b2340" },
    scoring: { rules: ["ghost +10", "crowned rare ghost +30", "wrong spot or laundry -5", "streaks add a bonus"], good: 250, great: 550 },
    messages: {
      low: ["the ghosts are giggling. quietly. somewhere.", "Your reflexes have filed a complaint.", "boo. that was the review."],
      mid: ["a moderately haunted performance.", "One minute of questionable decisions.", "the ghosts will remember your face."],
      high: ["professional ghost finder. it says so on your card.", "the room is a lot less haunted now.", "Again? Of course again."],
    },
    Thumbnail: GhostHuntThumb,
    Component: GhostHunt,
  },
];

export const GAME_IDS = GAMES.map((g) => g.id);

export function getGame(id: string) {
  return GAMES.find((g) => g.id === id) ?? null;
}
