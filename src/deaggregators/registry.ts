/**
 * Deaggregator registry - central place for registering and looking up
 * deaggregators by name.
 *
 * Importing this module ensures all deaggregator implementations are registered.
 */

// Import all deaggregator implementations to trigger their self-registration
import "./Split.ts";
import "./Unarray.ts";
import "./Unhash.ts";
