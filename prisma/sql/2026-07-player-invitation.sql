-- G3 PlayerInvitation integrity (applies on top of prisma db push).
-- One PENDING invitation per (team, email): the route checks before insert,
-- but only this partial unique closes the concurrent-request race.
CREATE UNIQUE INDEX IF NOT EXISTS "PlayerInvitation_pending_team_email_key"
  ON "PlayerInvitation" ("teamId", lower("invitedEmail"))
  WHERE status = 'PENDING';
