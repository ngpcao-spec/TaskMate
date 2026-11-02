import type { ImageSourcePropType } from 'react-native';
import type { PandaExpression, PandaStage, PandaVariant } from '@/domain/panda';

/**
 * Images du compagnon panda (D-104) : personnage original, images générées par IA puis retouchées, aucune image de tiers.
 * TOUS les `require` sont ici (statiques, comme l'exige Metro) : jamais de `require` d'image dans un écran.
 * Chaque image existe en 1024 px (`full`) et 512 px (`small`, défaut : suffisant jusqu'à ~250 pt). Fond transparent ; les « zzz » de `dort` sont
 * blancs : ne jamais afficher cette expression sur un fond blanc (le composant la pose sur le panneau marine du thème).
 */
export type PandaImageSize = 'full' | 'small';

type Pair = { full: ImageSourcePropType; small: ImageSourcePropType };

const STAGES: Record<PandaStage, Pair> = {
  1: { full: require('../../../assets/panda/panda-age-1-be.webp'), small: require('../../../assets/panda/panda-age-1-be@512.webp') },
  2: { full: require('../../../assets/panda/panda-age-2-nhi.webp'), small: require('../../../assets/panda/panda-age-2-nhi@512.webp') },
  3: { full: require('../../../assets/panda/panda-age-3-teen.webp'), small: require('../../../assets/panda/panda-age-3-teen@512.webp') },
  4: { full: require('../../../assets/panda/panda-age-4-dong-hanh.webp'), small: require('../../../assets/panda/panda-age-4-dong-hanh@512.webp') },
};

const EXPRESSIONS: Record<PandaExpression, Pair> = {
  content: { full: require('../../../assets/panda/panda-expr-content.webp'), small: require('../../../assets/panda/panda-expr-content@512.webp') },
  'tres-heureux': { full: require('../../../assets/panda/panda-expr-tres-heureux.webp'), small: require('../../../assets/panda/panda-expr-tres-heureux@512.webp') },
  surpris: { full: require('../../../assets/panda/panda-expr-surpris.webp'), small: require('../../../assets/panda/panda-expr-surpris@512.webp') },
  reflechit: { full: require('../../../assets/panda/panda-expr-reflechit.webp'), small: require('../../../assets/panda/panda-expr-reflechit@512.webp') },
  dort: { full: require('../../../assets/panda/panda-expr-dort.webp'), small: require('../../../assets/panda/panda-expr-dort@512.webp') },
  fier: { full: require('../../../assets/panda/panda-expr-fier.webp'), small: require('../../../assets/panda/panda-expr-fier@512.webp') },
};

/**
 * D-106 : variante du panda. Seules les images « boy » existent ; les images « girl » arriveront après le test. Une image absente pour la
 * variante demandée retombe TOUJOURS sur « boy » (jamais d'image vide).
 */
const STAGES_BY_VARIANT: Record<PandaVariant, Partial<Record<PandaStage, Pair>>> = { boy: STAGES, girl: {} };
const EXPRESSIONS_BY_VARIANT: Record<PandaVariant, Partial<Record<PandaExpression, Pair>>> = { boy: EXPRESSIONS, girl: {} };

export const pandaStageImage = (stage: PandaStage, size: PandaImageSize = 'small', variant: PandaVariant = 'boy'): ImageSourcePropType =>
  (STAGES_BY_VARIANT[variant][stage] ?? STAGES[stage])[size];
export const pandaExpressionImage = (expression: PandaExpression, size: PandaImageSize = 'small', variant: PandaVariant = 'boy'): ImageSourcePropType =>
  (EXPRESSIONS_BY_VARIANT[variant][expression] ?? EXPRESSIONS[expression])[size];
