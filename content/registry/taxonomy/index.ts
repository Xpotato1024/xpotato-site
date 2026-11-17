import { phase5TaxonomyRegistryData } from "./phase5-generated.js";
import { withEditorialTaxonomy } from "./editorial.js";

export const taxonomyRegistry = withEditorialTaxonomy(phase5TaxonomyRegistryData);
