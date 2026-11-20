/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Signup_Invite_Only_TitleInputs */



/**
* | output |
* | --- |
* | "Sign-up by invitation" |
*
* @param {Signup_Invite_Only_TitleInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const signup_invite_only_title = /** @type {((inputs?: Signup_Invite_Only_TitleInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Signup_Invite_Only_TitleInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Sign-up by invitation")
	return /** @type {LocalizedString} */ ("Inscription sur invitation")
});