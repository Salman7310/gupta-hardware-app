// The formatters live in core so a printed bill, which is built in a service,
// can use the same ones the screens do. Re-exported here so existing screens
// keep their import.
export { formatDate, formatTime } from '../core';
