/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Account_Timezone_HintInputs */



/**
* | output |
* | --- |
* | "Pick the one where you live: it sets the time of the daily digest (around 6 pm) and the day the year changes for drinking phases." |
*
* @param {Account_Timezone_HintInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const account_timezone_hint = /** @type {((inputs?: Account_Timezone_HintInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Account_Timezone_HintInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Pick the one where you live: it sets the time of the daily digest (around 6 pm) and the day the year changes for drinking phases.")
	return /** @type {LocalizedString} */ ("Choisissez celui de l'endroit où vous vivez : il fixe l'heure du résumé quotidien (vers 18 h) et le jour où l'année change pour les phases.")
});