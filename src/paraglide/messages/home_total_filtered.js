/* eslint-disable */
import * as __paraglideRegistry from '../registry.js'
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown>, total: NonNullable<unknown> }} Home_Total_FilteredInputs */



/**
* | countPlural | output |
* | --- | --- |
* | "one" | "{count} bottle of {total}" |
* | * | "{count} bottles of {total}" |
*
* @param {Home_Total_FilteredInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const home_total_filtered = /** @type {((inputs: Home_Total_FilteredInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Home_Total_FilteredInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") {
		const countPlural = __paraglideRegistry.plural("en", i?.count, {}, true);
		if (countPlural === "one") return /** @type {LocalizedString} */ (`${i?.count} bottle of ${i?.total}`);
		return /** @type {LocalizedString} */ (`${i?.count} bottles of ${i?.total}`)
	}
	{
		const countPlural = __paraglideRegistry.plural("fr", i?.count, {}, true);
		if (countPlural === "one") return /** @type {LocalizedString} */ (`${i?.count} bouteille sur ${i?.total}`);
		return /** @type {LocalizedString} */ (`${i?.count} bouteilles sur ${i?.total}`)
	}
});