# SpakTok: safe Supabase decommission

The original Supabase project was deleted. The native D1 auth, public feed,
social writes, and text chats are code-migrated but still require a real D1
instance and credentials to operate.

## Fail-closed UX
- Voice and video calls show an explicit unavailable state. The old Supabase
  Realtime signaling is not called and no camera/microphone permission is sought.
- Account settings do NOT claim to provide server-side 2FA or private profiles
  before the corresponding backend protections exist.
- Fictional wallet and gift balances are removed from the settings dashboard.
- Account deletion is clearly labeled not implemented; it must be developed
  with GDPR-aware export and cleanup before allowing general launch.
- Real-time messaging is not yet supported; text chat falls back to polling.
- Signed media uploads and multi-bitrate transcoding are not free by default.

Never allow a user to believe privacy settings, 2FA, end-to-end encryption,
or private content controls are in force until the server enforces them.
