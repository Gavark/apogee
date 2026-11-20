/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Signup_Invite_OnlyInputs */



/**
* | output |
* | --- |
* | "This link is no longer valid. Ask a member of your household or the administrator for a new invitation." |
*
* @param {Signup_Invite_OnlyInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const signup_invite_only = /** @type {((inputs?: Signup_Invite_OnlyInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Signup_Invite_OnlyInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("This link is no longer valid. Ask a member of your household or the administrator for a new invitation.")
	return /** @type {LocalizedString} */ ("Ce lien n'est plus valable. Demandez une nouvelle invitation à un membre de votre foyer ou à l'administrateur.")
});