import { Effect } from "effect";

export interface Profile {
  readonly name: string;
  readonly role: string;
}

// Capitalizes each word: "ada byron" becomes "Ada Byron".
const tidy = (text: string) =>
  text.replaceAll(/(?:^|\s)\p{Ll}/gu, (start) => start.toUpperCase());

// A pretend API. It stores the profile tidied, and answers with its stored copy: a new
// object every time, like a parsed response.
export const saveProfile = async (profile: Profile): Promise<Profile> => {
  await Effect.runPromise(Effect.sleep("400 millis"));
  return { name: tidy(profile.name), role: tidy(profile.role) };
};
