/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ model: NonNullable<unknown>, ms: NonNullable<unknown> }} Admin_Ai_Test_OkInputs */



/**
* | output |
* | --- |
* | "Test passed: {model}, {ms} ms." |
*
* @param {Admin_Ai_Test_OkInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const admin_ai_test_ok = /** @type {((inputs: Admin_Ai_Test_OkInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Ai_Test_OkInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ (`Test passed: ${i?.model}, ${i?.ms} ms.`)
	return /** @type {LocalizedString} */ (`Test réussi : ${i?.model}, ${i?.ms} ms.`)
});