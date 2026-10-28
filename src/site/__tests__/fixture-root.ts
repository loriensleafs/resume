// The fixture root of seam 1 (SPEC-site, Testing 1): a folder that holds the project's files, as the build script's
// --root reads them. Its resume.yaml is the repository's, with a name, a lead and a headline of its own, so a page that
// shows them read this root. Its private.yaml holds a fake phone number, so a file that holds it leaks a private
// detail. A task whose build step reads another project file adds that file here.

const REPO = `${import.meta.dir}/../../..`;

/** The fixture root's phone number, in NANPA's range for fiction (555-0100 to 555-0199). */
export const FAKE_PHONE = "(555) 555-0100";
/** Only the fixture root's resume.yaml holds this name, so a page title that shows it read that resume.yaml. */
export const FIXTURE_NAME = "The Fixture Root’s Name";
/** Only the fixture root's resume.yaml holds this lead, so a page that shows it read resume.yaml from that root. */
export const FIXTURE_LEAD = "The fixture root’s lead, which no other resume.yaml holds.";
/** Only the fixture root's resume.yaml holds this headline, so an app bar that shows it read that resume.yaml. */
export const FIXTURE_HEADLINE = "The fixture root’s headline, which no other resume.yaml holds";

/** Writes the fixture root into the folder `root`: its resume.yaml and its private.yaml. */
export async function writeFixtureRoot(root: string): Promise<void> {
  const source = Bun.YAML.parse(await Bun.file(`${REPO}/resume.yaml`).text()) as { basics: object };
  const fixtureSource = {
    ...source,
    basics: { ...source.basics, name: FIXTURE_NAME, summary: FIXTURE_LEAD, label: FIXTURE_HEADLINE },
  };
  await Bun.write(`${root}/resume.yaml`, Bun.YAML.stringify(fixtureSource));
  await Bun.write(`${root}/private.yaml`, `basics:\n  phone: ${FAKE_PHONE}\n`);
}
