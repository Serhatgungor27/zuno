import type { Metadata } from "next";
import { LegalPage, Section } from "../legal";

export const metadata: Metadata = {
  title: "Terms of Use — zuno",
  description: "The rules for using zuno.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use" updated="21 September 2026">
      <p>
        These are the terms for using zuno. Using the app means you accept them.
      </p>

      <Section title="Your account">
        <p>
          You need an account to use zuno, and you are responsible for what
          happens under it. Tell us if someone else gets into it. You can delete
          it at any time in Settings.
        </p>
        <p>You must be at least 13 to use zuno.</p>
      </Section>

      <Section title="What you post">
        <p>
          Your comments and profile are yours. By posting them you allow us to
          show them in the app to the people they are meant for.
        </p>
        <p>
          Do not post anything unlawful, abusive, hateful, or that harasses
          somebody. Do not impersonate other people. We can remove content and
          close accounts that do.
        </p>
      </Section>

      <Section title="Music and third-party services">
        <p>
          zuno does not host music. It plays short previews and shows charts,
          artwork and videos provided by Spotify, Deezer, Apple and YouTube, and
          links out to those services to play in full. Their content belongs to
          them and their own terms apply when you open them.
        </p>
        <p>
          Connecting a Spotify account is optional and you can disconnect it at
          any time.
        </p>
      </Section>

      <Section title="Fair use of the app">
        <p>
          Do not try to break the app, scrape it, pull data out of it in bulk,
          or use it to build a competing dataset.
        </p>
      </Section>

      <Section title="No warranty">
        <p>
          zuno is provided as it is. It may be unavailable, may lose data, and
          may change or stop entirely. We do not promise it will suit any
          particular purpose.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          These terms can change. The date at the top of this page changes with
          them, and continuing to use zuno means accepting the new ones.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Anything unclear here can go to{" "}
          <a href="mailto:serhatgung@gmail.com">serhatgung@gmail.com</a>.
        </p>
      </Section>
    </LegalPage>
  );
}
