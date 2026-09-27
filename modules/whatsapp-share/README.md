# whatsapp-share

Hands a rendered document straight to one named Android app rather than the
system chooser, so the shopkeeper reaches the customer's WhatsApp chat in one
tap instead of three.

`expo-sharing` cannot do this: it has no way to name a package, and WhatsApp's
own `wa.me` and `whatsapp://` links can carry text but never a file. Sending a
PDF to a named app needs `ACTION_SEND` with `setPackage`, a `content://` uri
from a `FileProvider`, and `FLAG_GRANT_READ_URI_PERMISSION` — which is what
this module is.

The `jid` extra, which opens one contact's chat instead of WhatsApp's picker,
is not a documented WhatsApp API. A build that ignores it falls back to the
picker, so the share still works; it just costs one more tap.

`packageName` is a parameter rather than being hard-coded to WhatsApp so the
mechanism can be exercised against an app that is actually installed — there
is no WhatsApp on a bare emulator.
