import { ComingSoon } from "@/components/ComingSoon";

export default function ProfilePage() {
  return (
    <ComingSoon
      title="Profile"
      blurb="Identity, stats and the Coin shop."
      bullets={[
        "Avatar with an earned frame, league badge, streak",
        "Shop: Streak Freeze, Quest Reroll, frames, themes",
        "Settings: language, theme, notifications, plan",
      ]}
    />
  );
}
