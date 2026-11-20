/* eslint-disable */
import * as __paraglideRegistry from '../registry.js'
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown>, names: NonNullable<unknown> }} Notif_Digest_MonthlyInputs */



/**
* | countPlural | output |
* | --- | --- |
* | "one" | "This month, {count} bottle not to forget: {names}" |
* | * | "This month, {count} bottles not to forget: {names}" |
*
* @param {Notif_Digest_MonthlyInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const notif_digest_monthly = /** @type {((inputs: Notif_Digest_MonthlyInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Notif_Digest_MonthlyInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") {
		const countPlural = __paraglideRegistry.plural("en", i?.count, {}, true);
		if (countPlural === "one") return /** @type {LocalizedString} */ (`This month, ${i?.count} bottle not to forget: ${i?.names}`);
		return /** @type {LocalizedString} */ (`This month, ${i?.count} bottles not to forget: ${i?.names}`)
	}
	{
		const countPlural = __paraglideRegistry.plural("fr", i?.count, {}, true);
		if (countPlural === "one") return /** @type {LocalizedString} */ (`Ce mois-ci, ${i?.count} bouteille à ne pas oublier : ${i?.names}`);
		return /** @type {LocalizedString} */ (`Ce mois-ci, ${i?.count} bouteilles à ne pas oublier : ${i?.names}`)
	}
});