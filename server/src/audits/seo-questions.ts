import type { AuditContext, AuditResult, CheckResult, CategoryResult } from '../types.js';
import type { SeoAuditAnswerRecord } from '../db/schema.js';

/**
 * SEO Question definition
 */
export interface SeoQuestion {
  id: string;
  category: string;
  question: string;
  importance: 'critical' | 'high' | 'medium' | 'low';
  checkIds: string[]; // Related check IDs to answer this question
}

/**
 * Answer to an SEO question
 */
export interface SeoAnswer {
  questionId: string;
  question: string;
  answer: 'yes' | 'no' | 'partial' | 'unknown';
  status: 'pass' | 'fail' | 'warning' | 'info';
  details?: string;
  affectedPages?: string[];
  metrics?: Record<string, number>;
  recommendation?: string;
}

/**
 * Comprehensive list of SEO audit questions
 * Organized by category with importance levels
 */
export const SEO_QUESTIONS: SeoQuestion[] = [
  // === ARCHITECTURE & NAVIGATION ===
  { id: 'Q1', category: 'Architecture', question: 'Si le site contient des catégories et sous-catégories, est-ce que l\'architecture des URLs est en harmonie avec l\'architecture de la navigation ?', importance: 'high', checkIds: ['url-structure'] },
  { id: 'Q2', category: 'Architecture', question: 'Est-ce que certaines pages ne méritent pas d\'exister (et de faire partie de la navigation) ?', importance: 'medium', checkIds: ['page-value'] },
  { id: 'Q3', category: 'Architecture', question: 'S\'il y a une navigation à facettes ou avec filtres et si cela génère des URLs uniques, est-ce qu\'une url canonique est déclarée?', importance: 'high', checkIds: ['canonical', 'faceted-nav'] },

  // === PAGINATION ===
  { id: 'Q4', category: 'Pagination', question: 'Si le site utilise un système de pagination, est-ce que certaines pages paginées retournent un code réponse différent de 200 ?', importance: 'high', checkIds: ['pagination-status'] },
  { id: 'Q5', category: 'Pagination', question: 'Si le site utilise un système de pagination, est-ce que les pages paginées sont bien ordonnées (N-1 > N > N+1)?', importance: 'medium', checkIds: ['pagination-order'] },
  { id: 'Q6', category: 'Pagination', question: 'Si le site utilise un système de pagination, est-ce que les instructions prev/next indiquent bien qu\'une seule URL précedent et suivante?', importance: 'medium', checkIds: ['pagination-prev-next'] },
  { id: 'Q7', category: 'Pagination', question: 'Si le site utilise un système de pagination, est-ce que chaque page paginée indique correctement l\'URL canonique (self canonical)?', importance: 'high', checkIds: ['pagination-canonical'] },
  { id: 'Q8', category: 'Pagination', question: 'Si le site utilise un système de pagination, est-ce que les pages paginées sont bien en index, follow?', importance: 'high', checkIds: ['pagination-index'] },

  // === INTERNAL LINKING ===
  { id: 'Q9', category: 'Maillage interne', question: 'Est-ce que certaines pages sont trop profondes (au délà de 3 clics à partir de la page d\'accueil)?', importance: 'high', checkIds: ['page-depth'] },
  { id: 'Q10', category: 'Maillage interne', question: 'Est-ce que les pages qui reçoivent le plus de liens internes sont celles qui ciblent les mots clés les plus importants pour le site?', importance: 'high', checkIds: ['internal-link-priority'] },
  { id: 'Q11', category: 'Maillage interne', question: 'Existe-t-il des pages orphelines?', importance: 'high', checkIds: ['orphan-pages'] },

  // === TITLE TAGS ===
  { id: 'Q12', category: 'Title', question: 'Existe t-il des pages avec une balise <title> manquante', importance: 'critical', checkIds: ['title-missing'] },
  { id: 'Q13', category: 'Title', question: 'Y\'a t-il des pages avec balises <title> dupliquées?', importance: 'critical', checkIds: ['title-duplicate'] },
  { id: 'Q14', category: 'Title', question: 'Y\'a t-il des pages avec balises Title dont le nombre de pixels est supérieur à 512?', importance: 'medium', checkIds: ['title-pixels'] },
  { id: 'Q15', category: 'Title', question: 'Y\'a t-il des pages avec balises Title possédant moins de 30 caractères', importance: 'medium', checkIds: ['title-length'] },
  { id: 'Q16', category: 'Title', question: 'Est-ce que sur les pages les plus importantes, la balise Title inclut une fois le mot clé principal?', importance: 'high', checkIds: ['title-keyword'] },
  { id: 'Q17', category: 'Title', question: 'Est-ce que sur les pages les plus importantes, le mot clé est placé au début dans la balise Title?', importance: 'high', checkIds: ['title-keyword-position'] },

  // === META DESCRIPTION ===
  { id: 'Q18', category: 'Meta Description', question: 'Y\'a t-il des pages ayant une balise meta description manquante ou vide', importance: 'high', checkIds: ['meta-desc-missing'] },
  { id: 'Q19', category: 'Meta Description', question: 'Y\'a t-il des pages ayant une balise meta description dupliquée?', importance: 'high', checkIds: ['meta-desc-duplicate'] },
  { id: 'Q20', category: 'Meta Description', question: 'Y\'a t-il des pages dont la balise meta description contient plus de 835 pixels?', importance: 'medium', checkIds: ['meta-desc-pixels'] },
  { id: 'Q21', category: 'Meta Description', question: 'Y\'a t-il des pages avec une balise meta description possédant moins de 70 caractères', importance: 'medium', checkIds: ['meta-desc-length'] },
  { id: 'Q22', category: 'Meta Description', question: 'Est-ce que sur les pages les plus importantes, la balise Meta description contient le mot clé principal?', importance: 'high', checkIds: ['meta-desc-keyword'] },

  // === H1 TAGS ===
  { id: 'Q23', category: 'H1', question: 'Y\'a t-il des pages avec balises H1 manquantes ou vides?', importance: 'critical', checkIds: ['h1-missing'] },
  { id: 'Q24', category: 'H1', question: 'Y\'a t-il des pages avec des balises H1 identiques / dupliquées', importance: 'high', checkIds: ['h1-duplicate'] },
  { id: 'Q25', category: 'H1', question: 'Y\'a t-il des pages avec balises H1 dépassant les 70 caractères', importance: 'medium', checkIds: ['h1-length'] },
  { id: 'Q26', category: 'H1', question: 'Y\'a t-il des pages contenant plusieurs balises H1', importance: 'high', checkIds: ['h1-multiple'] },

  // === H2 TAGS ===
  { id: 'Q27', category: 'H2', question: 'Y\'a t-il des pages avec balises H2 manquantes ou vides qui devraient pourtant en tirer profit?', importance: 'medium', checkIds: ['h2-missing'] },
  { id: 'Q28', category: 'H2', question: 'Y\'a t-il des pages avec balises H2 dépassant les 70 caractères', importance: 'low', checkIds: ['h2-length'] },
  { id: 'Q29', category: 'Structure', question: 'Est-ce que les pages importantes sont bien structurées à l\'aide des balises Hn?', importance: 'high', checkIds: ['heading-hierarchy'] },
  { id: 'Q30', category: 'Structure', question: 'Y\'a t-il des balises Hn de très petite taille?', importance: 'low', checkIds: ['heading-size'] },

  // === CONTENU & MOTS-CLÉS ===
  { id: 'Q31', category: 'Contenu', question: 'Est-ce que sur les pages les plus importantes, le mot clé principal est inclus dans les 100 premiers mots de la page?', importance: 'high', checkIds: ['keyword-first-100'] },
  { id: 'Q32', category: 'Contenu', question: 'Est-ce que sur les pages les plus importantes, le mot clé est inclus dans les 150 derniers mots?', importance: 'medium', checkIds: ['keyword-last-150'] },
  { id: 'Q33', category: 'Contenu', question: 'Est-ce que sur les pages les plus importantes, le mot clé principal est inclus dans la balise H1?', importance: 'high', checkIds: ['keyword-in-h1'] },
  { id: 'Q34', category: 'Contenu', question: 'Est-ce que sur les pages les plus importantes, le mot clé principal est inclus dans au moins une balise H2?', importance: 'high', checkIds: ['keyword-in-h2'] },

  // === DONNÉES STRUCTURÉES ===
  { id: 'Q35', category: 'Schema', question: 'Le site utilise t-il des données structurées?', importance: 'high', checkIds: ['structured-data'] },
  { id: 'Q36', category: 'Schema', question: 'Y\'a t-il des problèmes liés aux données structurées?', importance: 'high', checkIds: ['structured-data-errors'] },

  // === IMAGES ===
  { id: 'Q37', category: 'Images', question: 'Est-ce que le poids de toutes les images est inférieur à 100 ko?', importance: 'high', checkIds: ['image-size'] },
  { id: 'Q38', category: 'Images', question: 'Est-ce que sur les pages les plus importantes, les noms de chaque image décrivent bien les images?', importance: 'medium', checkIds: ['image-filename'] },
  { id: 'Q39', category: 'Images', question: 'Est-ce que toutes les images utilisent des attributs ALT dans la balise img?', importance: 'high', checkIds: ['image-alt'] },
  { id: 'Q40', category: 'Images', question: 'Est-ce que les attributs ALT sont bien traduits dans chaque langue?', importance: 'medium', checkIds: ['alt-translation'] },

  // === INTERNATIONALISATION ===
  { id: 'Q41', category: 'International', question: 'Est-ce que les URLs des pages localisées sont bien traduites?', importance: 'medium', checkIds: ['localized-urls'] },

  // === ANALYTICS ===
  { id: 'Q42', category: 'Analytics', question: 'Est-ce que le code de suivi se trouve bien sur toutes les pages du site?', importance: 'critical', checkIds: ['tracking-code'] },
  { id: 'Q43', category: 'Analytics', question: 'Est-ce que le site utilise bien Universal Analytics (et non pas Google Analytics classique)?', importance: 'medium', checkIds: ['universal-analytics'] },
  { id: 'Q44', category: 'Analytics', question: 'Est-ce que certains liens internes contiennent des URLs de campagne?', importance: 'medium', checkIds: ['internal-campaign-urls'] },

  // === PERFORMANCE ===
  { id: 'Q45', category: 'Performance', question: 'Est-ce que le score de vitesse Google Page Speed Insights (ordinateur) est supérieur à 90, pour les pages importantes?', importance: 'high', checkIds: ['psi-desktop'] },
  { id: 'Q46', category: 'Performance', question: 'Est-ce que le score de vitesse Google Page Speed Insights (mobile) est supérieur à 90, pour les pages importantes?', importance: 'high', checkIds: ['psi-mobile'] },

  // === SÉCURITÉ ===
  { id: 'Q47', category: 'Sécurité', question: 'Est-ce que certains contenus ne sont pas sécurisés?', importance: 'high', checkIds: ['mixed-content'] },

  // === CODES HTTP & REDIRECTIONS ===
  { id: 'Q48', category: 'Statut HTTP', question: 'Y\'a t-il des redirections 302 internes?', importance: 'high', checkIds: ['redirect-302'] },
  { id: 'Q49', category: 'Statut HTTP', question: 'Y\'a t-il des pages qui retournent un code 403?', importance: 'high', checkIds: ['status-403'] },
  { id: 'Q50', category: 'Statut HTTP', question: 'Y\'a t-il des pages qui retournent un code 404?', importance: 'high', checkIds: ['status-404'] },
  { id: 'Q51', category: 'Statut HTTP', question: 'Y\'a t-il des pages qui retournent un code 500?', importance: 'critical', checkIds: ['status-500'] },
  { id: 'Q52', category: 'Statut HTTP', question: 'Y\'a t-il des pages ne retournant aucune réponse (time-out)?', importance: 'critical', checkIds: ['timeout'] },
  { id: 'Q53', category: 'Statut HTTP', question: 'Y\'a t-il des chaines de redirection?', importance: 'high', checkIds: ['redirect-chains'] },
  { id: 'Q54', category: 'Statut HTTP', question: 'Y\'a t-il des redirections Meta Refresh utilisées?', importance: 'medium', checkIds: ['meta-refresh'] },

  { id: 'Q55', category: 'Backlinks', question: 'Y a t-il un gain rapide en termes de domaines référents?', importance: 'high', checkIds: ['refdomains-spike'] },
  { id: 'Q56', category: 'Backlinks', question: 'Y a t-il une chute en termes de domaines référents?', importance: 'high', checkIds: ['refdomains-drop'] },
  { id: 'Q57', category: 'Backlinks', question: 'Y a t-il un pic (gain rapide suivi d\'une chute) en termes de domaines référents?', importance: 'high', checkIds: ['refdomains-spike-drop'] },
  { id: 'Q58', category: 'Backlinks', question: 'Est-ce que la courbe d\'évolution des domaines référents est positive?', importance: 'medium', checkIds: ['refdomains-trend'] },
  { id: 'Q59', category: 'Backlinks', question: 'Est-ce qu\'un même mot ou une même phrase est utilisée trop fréquemment dans les ancres de lien des backlinks?', importance: 'high', checkIds: ['anchor-overuse'] },
  { id: 'Q60', category: 'Backlinks', question: 'Est-ce que plus de 25% des domaines référents ont une extension (TLD) ne correspondant pas au pays principal ciblé?', importance: 'medium', checkIds: ['tld-mismatch'] },
  { id: 'Q61', category: 'Backlinks', question: 'Y a t-il des backlinks pointant vers des pages retournant un code erreur 404?', importance: 'high', checkIds: ['broken-backlinks'] },
  { id: 'Q62', category: 'Backlinks', question: 'Y a t-il des domaines référents de mauvaise qualité?', importance: 'high', checkIds: ['low-quality-refdomains'] },
  { id: 'Q63', category: 'Backlinks', question: 'Est-ce que certains backlinks sont achetés/sponsorisés sans directive "nofollow"?', importance: 'critical', checkIds: ['sponsored-links'] },
  { id: 'Q64', category: 'Backlinks', question: 'Y a t-il des backlinks provenant d\'annuaires généralistes qui acceptent toutes les inscriptions ou d\'annuaires de liens?', importance: 'medium', checkIds: ['directory-links'] },
];

/**
 * Map check results to question answers
 */
export function answerQuestionFromChecks(
  question: SeoQuestion,
  checks: CheckResult[]
): SeoAnswer {
  // Find relevant checks for this question
  const relevantChecks = checks.filter(c => question.checkIds.includes(c.id));
  
  if (relevantChecks.length === 0) {
    return {
      questionId: question.id,
      question: question.question,
      answer: 'unknown',
      status: 'info',
      details: 'No checks available to answer this question',
    };
  }

  // Calculate aggregate score
  const avgScore = relevantChecks.reduce((sum, c) => sum + c.score, 0) / relevantChecks.length;
  const allPassed = relevantChecks.every(c => c.status === 'pass');
  const anyFailed = relevantChecks.some(c => c.status === 'fail');
  const anyWarning = relevantChecks.some(c => c.status === 'warning');

  // Determine answer
  let answer: 'yes' | 'no' | 'partial' | 'unknown';
  let status: 'pass' | 'fail' | 'warning' | 'info';

  if (allPassed) {
    answer = 'yes';
    status = 'pass';
  } else if (anyFailed) {
    answer = 'no';
    status = 'fail';
  } else if (anyWarning) {
    answer = 'partial';
    status = 'warning';
  } else {
    answer = 'unknown';
    status = 'info';
  }

  // Build details
  const details = relevantChecks
    .filter(c => c.details)
    .map(c => c.details)
    .join('\n');

  // Build metrics
  const metrics: Record<string, number> = {
    score: Math.round(avgScore),
    checksRun: relevantChecks.length,
    passed: relevantChecks.filter(c => c.status === 'pass').length,
    failed: relevantChecks.filter(c => c.status === 'fail').length,
    warnings: relevantChecks.filter(c => c.status === 'warning').length,
  };

  return {
    questionId: question.id,
    question: question.question,
    answer,
    status,
    details: details || undefined,
    metrics,
    recommendation: getRecommendation(question, answer),
  };
}

/**
 * Get recommendation for a question based on answer
 */
function getRecommendation(question: SeoQuestion, answer: 'yes' | 'no' | 'partial' | 'unknown'): string | undefined {
  if (answer === 'yes') return undefined;

  const recommendations: Record<string, string> = {
    'Q1': 'Install an SSL certificate and redirect all HTTP traffic to HTTPS.',
    'Q2': 'Create a robots.txt file in the root directory with appropriate crawl directives.',
    'Q3': 'Generate an XML sitemap and submit it to Google Search Console.',
    'Q4': 'Fix all 4xx and 5xx errors. Ensure all important pages return 200 status.',
    'Q5': 'Optimize server performance, enable caching, use a CDN.',
    'Q11': 'Add unique title tags to every page, targeting primary keywords.',
    'Q12': 'Keep title tags between 50-60 characters to prevent truncation.',
    'Q13': 'Write unique meta descriptions for each page, 150-160 characters.',
    'Q21': 'Ensure every page has exactly one H1 tag describing the main topic.',
    'Q23': 'Structure headings hierarchically: H1 → H2 → H3, without skipping levels.',
    'Q27': 'Aim for at least 300 words of unique, valuable content per page.',
    'Q31': 'Add descriptive alt text to all images for accessibility and SEO.',
    'Q32': 'Compress images, use WebP format, implement lazy loading.',
    'Q36': 'Increase internal linking to improve crawlability and distribute PageRank.',
    'Q38': 'Link to orphan pages from relevant content or add to navigation/sitemap.',
    'Q41': 'Use clean, descriptive URLs with keywords separated by hyphens.',
    'Q46': 'Implement a clear, consistent navigation menu accessible from all pages.',
    'Q50': 'Install Google Analytics 4 (GA4) on all pages for tracking.',
    'Q51': 'Set up conversion goals and events in GA4 or Google Ads.',
    'Q54': 'Implement JSON-LD structured data for rich snippets in search results.',
  };

  return recommendations[question.id];
}

/**
 * Generate answers for all SEO questions from audit results
 */
export function generateSeoAnswers(auditResult: AuditResult): SeoAnswer[] {
  // Flatten all checks from all categories
  const allChecks: CheckResult[] = [];
  auditResult.categories.forEach(cat => {
    allChecks.push(...cat.checks);
  });

  // Answer each question
  return SEO_QUESTIONS.map(question => answerQuestionFromChecks(question, allChecks));
}

/**
 * Calculate overall SEO score based on question answers
 */
export function calculateOverallSeoScore(answers: SeoAnswer[]): number {
  // Weight by importance
  const weights: Record<string, number> = {
    critical: 3,
    high: 2,
    medium: 1,
    low: 0.5,
  };

  let totalWeight = 0;
  let weightedScore = 0;

  answers.forEach((answer, index) => {
    const question = SEO_QUESTIONS[index];
    if (!question) return;

    const weight = weights[question.importance];
    totalWeight += weight;

    // Score based on answer
    let score = 0;
    if (answer.status === 'pass') score = 100;
    else if (answer.status === 'warning') score = 60;
    else if (answer.status === 'fail') score = 0;
    else score = 50; // info/unknown

    weightedScore += score * weight;
  });

  return totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
}

/**
 * Get category breakdown from answers
 */
export function getCategoryBreakdown(answers: SeoAnswer[]): Record<string, { score: number; passed: number; failed: number; total: number }> {
  const categories: Record<string, { scores: number[]; passed: number; failed: number }> = {};

  answers.forEach((answer, index) => {
    const question = SEO_QUESTIONS[index];
    if (!question) return;

    if (!categories[question.category]) {
      categories[question.category] = { scores: [], passed: 0, failed: 0 };
    }

    categories[question.category].scores.push(answer.metrics?.score ?? 50);
    if (answer.status === 'pass') categories[question.category].passed++;
    if (answer.status === 'fail') categories[question.category].failed++;
  });

  const result: Record<string, { score: number; passed: number; failed: number; total: number }> = {};
  Object.entries(categories).forEach(([cat, data]) => {
    result[cat] = {
      score: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
      passed: data.passed,
      failed: data.failed,
      total: data.scores.length,
    };
  });

  return result;
}

/**
 * Convert SeoAnswer to database record format
 */
export function toSeoAuditAnswerRecord(
  auditId: string,
  answer: SeoAnswer
): Omit<SeoAuditAnswerRecord, 'id' | 'createdAt'> {
  return {
    auditId,
    questionId: answer.questionId,
    question: answer.question,
    answer: answer.answer,
    status: answer.status,
    details: answer.details || null,
    affectedPages: answer.affectedPages || [],
    metrics: answer.metrics || {},
  };
}

/**
 * Get summary report of SEO audit
 */
export function getSeoAuditSummary(answers: SeoAnswer[]): {
  overallScore: number;
  criticalIssues: string[];
  quickWins: string[];
  categoryScores: Record<string, number>;
} {
  const overallScore = calculateOverallSeoScore(answers);
  const criticalIssues: string[] = [];
  const quickWins: string[] = [];

  answers.forEach((answer, index) => {
    const question = SEO_QUESTIONS[index];
    if (!question) return;

    if (answer.status === 'fail') {
      if (question.importance === 'critical' || question.importance === 'high') {
        criticalIssues.push(question.question);
      } else {
        quickWins.push(question.question);
      }
    } else if (answer.status === 'warning' && question.importance === 'critical') {
      criticalIssues.push(`${question.question} (partial)`);
    }
  });

  const categoryScores: Record<string, number> = {};
  const breakdown = getCategoryBreakdown(answers);
  Object.entries(breakdown).forEach(([cat, data]) => {
    categoryScores[cat] = data.score;
  });

  return {
    overallScore,
    criticalIssues,
    quickWins,
    categoryScores,
  };
}

/**
 * Export questions for UI
 */
export function getQuestionsByCategory(): Record<string, SeoQuestion[]> {
  const result: Record<string, SeoQuestion[]> = {};
  
  SEO_QUESTIONS.forEach(q => {
    if (!result[q.category]) {
      result[q.category] = [];
    }
    result[q.category].push(q);
  });

  return result;
}
