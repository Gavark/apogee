/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Notif_Pref_Phases_HintInputs */



/**
* | output |
* | --- |
* | "A wine enters its drinking window, reaches its peak, becomes drink-soon or is past its prime." |
*
* @param {Notif_Pref_Phases_HintInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const notif_pref_phases_hint = /** @type {((inputs?: Notif_Pref_Phases_HintInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Notif_Pref_Phases_HintInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("A wine enters its drinking window, reaches its peak, becomes drink-soon or is past its prime.")
	return /** @type {LocalizedString} */ ("Un vin entre dans sa fenêtre de dégustation, atteint son apogée, passe à boire vite ou est passé.")
});