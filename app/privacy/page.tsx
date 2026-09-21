import type { Metadata } from "next";
import { LegalPage, Section } from "../legal";

export const metadata: Metadata = {
  title: "Privacy Policy — zuno",
  description: "What zuno collects, why, and how to get rid of it.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="21 September 2026">
      <p>
        zuno is a music discovery app. This page describes exactly what it
        stores about you and why. It is written to be read, not to be skimmed
        past.
      </p>

      <Section title="What we store">
        <p>
          <strong>Your account.</strong> When you sign in we keep the identity
          your provider gives us — an email address for a Google or email
          sign-in, and for a Spotify connection your Spotify user id, display
          name, profile picture and access tokens. The tokens are what let us
          read what you are playing; they are stored on our server and never
          sent to anyone else.
        </p>
        <p>
          <strong>Your profile.</strong> Username, bio, and the artists and
          genres you list as your taste.
        </p>
        <p>
          <strong>What you listen to.</strong> Tracks played through a
          connected Spotify account, so they can appear on your profile and in
          your followers&rsquo; feeds.
        </p>
        <p>
          <strong>What you do in the app.</strong> Follows, reposts, likes,
          comments, and the tracks you like or turn down in Discover.
        </p>
        <p>
          <strong>How you use Discover.</strong> For each card: how long it was
          on screen and how much of the track played. This is what makes the
          feed improve as you use it. It is tied to your account so it survives
          reinstalling the app.
        </p>
      </Section>

      <Section title="What we do with it">
        <p>
          We use it to run the app: to show your profile, to build your feed, to
          tell you when someone follows or comments, and to work out what music
          to recommend you next.
        </p>
        <p>
          We do not sell it, we do not share it with advertisers, and we do not
          use it to build a profile of you for anyone else&rsquo;s purposes.
        </p>
      </Section>

      <Section title="Who else sees it">
        <p>
          <strong>Other people using zuno</strong> can see your public profile,
          your username and picture, what you have been listening to, your
          reposts, your taste, and your comments. Ghost mode, in Settings, hides
          your listening from the feed.
        </p>
        <p>
          <strong>Services we run on.</strong> Supabase stores the database and
          handles sign-in; Vercel hosts and serves the app. Both process data on
          our behalf.
        </p>
        <p>
          <strong>Services we look things up in.</strong> To find artwork,
          previews, charts and music videos we query Spotify, Deezer, Apple and
          YouTube. These requests carry the track or artist being looked up.
          They do not carry your identity.
        </p>
      </Section>

      <Section title="Getting rid of it">
        <p>
          Deleting your account in Settings removes your profile, your listening
          history, your follows, your reposts, your likes and comments, and
          everything Discover has learned about you. It is not recoverable
          afterwards.
        </p>
        <p>
          You can also turn on ghost mode to stop new listening being shared
          without deleting anything.
        </p>
      </Section>

      <Section title="Children">
        <p>
          zuno is not intended for children under 13, and we do not knowingly
          collect anything about them.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          If this changes in a way that affects what we collect or who sees it,
          the date at the top of this page changes with it.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about any of this can go to{" "}
          <a href="mailto:serhatgung@gmail.com">serhatgung@gmail.com</a>.
        </p>
      </Section>
    </LegalPage>
  );
}
