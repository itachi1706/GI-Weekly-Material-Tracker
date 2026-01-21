
export interface Character {
    image: string | null;
    gender: string | null;
    birthday: string | null;
    caption: string | null;
    titles: string[];
    name: string | null;
    fullName: string | null;
    description: string | null;
    nation: string | null;
    weapon: string | null;
    rarity: number;
    affiliation: string | null;
    constellation: string | null;
    outfits: string[];
    talents: Record<string, any>; // Complex nested object, keeping flexible for now
    ascension: Record<string, any>;
    materials: Record<string, any>;

    // Reference fields
    introduction: string | null;
    paimonmoepath: string | null;
    genshinggpath: string | null;
    element: string | null;
    released: boolean;
    wiki: string | null;
    hoyowiki: number | string | null;
    subCollection: Record<string, any>;
}

export interface Weapon {
    secondary_stat_type: string | null;
    description: string | null;
    name: string | null;
    series: string | null;
    ascension: Record<string, any>;
    materials: Record<string, any>;
    image: string;
    secondary_stat: string | null;
    rarity: number;
    type: string;
    max_secondary_stat: string | null;
    max_base_atk: number | null;
    base_atk: number | null;
    obtained: string | null;
    effectName: string | null;
    effect: string | null;
    released: boolean;
    wiki: string | null;
    hoyowiki: number | string | null;
    subCollection: Record<string, any>;
}

export interface Material {
    image: string;
    rarity: number;
    type: string;
    innerType?: string;
    innerSubType?: string;
    description: string | null;
    enemies?: string[];
    obtained: string | null;
    name: string | null;
    released: boolean;
    wiki: string | null;
    usage: {
        characters: string[];
        weapons: string[];
    };
    hoyowiki: number | string | null;
    subCollection: Record<string, any>;
    days?: number[]; // For domains
}

export interface Outfit {
    name: string | null;
    character: string | null;
    characters: string[];
    rarity: number;
    image: string;
    thumbnail: string;
    wishimage: string;
    "3dmodel": string | null;
    description: string | null;
    obtained: string | null;
    lore: string | null;
    type: string;
    shop: boolean;
    shop_cost: number;
    shop_cost_discounted: number;
    shop_cost_discounted_till: string | null;
    event_give_free: boolean;
    event_give_free_till: string | null;
    released_version: number;
    released_version_name?: string | null;
    released: boolean;
    wiki: string | null;
    subCollection: Record<string, any>;
}

export type CollectionType = 'characters' | 'weapons' | 'materials' | 'outfits';
