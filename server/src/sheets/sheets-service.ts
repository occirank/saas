import { google } from 'googleapis';
import fs from 'fs';
import { oauthService } from './oauth-service.js';
export const AUDIT_QUESTIONS = [
    // Q1-Q3: ARCHITECTURE & NAVIGATION
    { id: 'Q1', question: "Si le site contient des catégories et sous-catégories, est-ce que l'architecture des URLs est en harmonie avec l'architecture de la navigation ?", category: 'Architecture', notes: 'Vérifier la cohérence entre structure URL et menu', issueMatchers: ['URL navigation mismatch'], invertStatus: true },
    { id: 'Q2', question: "Est-ce que certaines pages ne méritent pas d'exister (et de faire partie de la navigation) ?", category: 'Architecture', notes: 'Identifier les pages à faible valeur SEO', issueMatchers: ['Low value page'], invertStatus: true },
    { id: 'Q3', question: "S'il y a une navigation à facettes ou avec filtres et si cela génère des URLs uniques, est-ce qu'une url canonique est déclarée?", category: 'Architecture', notes: 'Éviter le contenu dupliqué des filtres', issueMatchers: ['Faceted navigation without canonical', 'URL with parameters but no canonical'], invertStatus: true },
    // Q4-Q8: PAGINATION
    { id: 'Q4', question: "Si le site utilise un système de pagination, est-ce que certaines pages paginées retournent un code réponse différent de 200 ?", category: 'Pagination', notes: 'Toutes les pages paginées doivent être accessibles', issueMatchers: ['Paginated page non-200'], invertStatus: true },
    { id: 'Q5', question: "Si le site utilise un système de pagination, est-ce que les pages paginées sont bien ordonnées (N-1 > N > N+1)?", category: 'Pagination', notes: 'Vérifier la logique de navigation entre pages', issueMatchers: ['Pagination order issue'], invertStatus: true },
    { id: 'Q6', question: "Si le site utilise un système de pagination, est-ce que les instructions prev/next indiquent bien qu'une seule URL précédent et suivante?", category: 'Pagination', notes: 'Rel prev/next pour optimiser le crawl', issueMatchers: ['Missing prev link', 'Missing next link'], invertStatus: true },
    { id: 'Q7', question: "Si le site utilise un système de pagination, est-ce que chaque page paginée indique correctement l'URL canonique (self canonical)?", category: 'Pagination', notes: 'Self-referencing canonical sur chaque page', issueMatchers: ['Paginated page non-self canonical'], invertStatus: true },
    { id: 'Q8', question: "Si le site utilise un système de pagination, est-ce que les pages paginées sont bien en index, follow?", category: 'Pagination', notes: 'Éviter noindex sur pages paginées', issueMatchers: ['Paginated page noindex'], invertStatus: true },
    // Q9-Q11: INTERNAL LINKING
    { id: 'Q9', question: "Est-ce que certaines pages sont trop profondes (au delà de 3 clics à partir de la page d'accueil)?", category: 'Maillage interne', notes: 'Pages à plus de 3 clics = faible autorité', issueMatchers: ['Deep page'], invertStatus: true },
    { id: 'Q10', question: "Est-ce que les pages qui reçoivent le plus de liens internes sont celles qui ciblent les mots clés les plus importants pour le site?", category: 'Maillage interne', notes: 'Optimiser le PageRank interne vers pages stratégiques', issueMatchers: ['Link juice distribution issue'], invertStatus: true },
    { id: 'Q11', question: "Existe-t-il des pages orphelines?", category: 'Maillage interne', notes: 'Pages sans liens internes = non découvrables', issueMatchers: ['Orphan page'], invertStatus: true },
    // Q12-Q17: TITLE TAGS
    { id: 'Q12', question: "Existe t-il des pages avec une balise <title> manquante", category: 'Title', notes: 'Title obligatoire pour le référencement', issueMatchers: ['Missing title tag'], invertStatus: true },
    { id: 'Q13', question: "Y'a t-il des pages avec balises <title> dupliquées?", category: 'Title', notes: 'Chaque page doit avoir un title unique', issueMatchers: ['Duplicate title tag'], invertStatus: true },
    { id: 'Q14', question: "Y'a t-il des pages avec balises Title dont le nombre de pixels est supérieur à 512?", category: 'Title', notes: 'Title tronqué dans les SERP au-delà de 512px', issueMatchers: ['Title pixel width > 512px', 'Title pixel'], invertStatus: true },
    { id: 'Q15', question: "Y'a t-il des pages avec balises Title possédant moins de 30 caractères", category: 'Title', notes: 'Title trop court = opportunité SEO manquée', issueMatchers: ['Title too short'], invertStatus: true },
    { id: 'Q16', question: "Est-ce que sur les pages les plus importantes, la balise Title inclut une fois le mot clé principal?", category: 'Title', notes: 'Mot clé dans title = signal de pertinence', issueMatchers: ['Keyword not in title'], invertStatus: true },
    { id: 'Q17', question: "Est-ce que sur les pages les plus importantes, le mot clé est placé au début dans la balise Title?", category: 'Title', notes: 'Mot clé en début de title = meilleur impact', issueMatchers: ['Keyword not at start of title'], invertStatus: true },
    // Q18-Q22: META DESCRIPTION
    { id: 'Q18', question: "Y'a t-il des pages ayant une balise meta description manquante ou vide", category: 'Meta Description', notes: 'Meta description influence le CTR', issueMatchers: ['Missing meta description'], invertStatus: true },
    { id: 'Q19', question: "Y'a t-il des pages ayant une balise meta description dupliquée?", category: 'Meta Description', notes: 'Description unique pour chaque page', issueMatchers: ['Duplicate meta description'], invertStatus: true },
    { id: 'Q20', question: "Y'a t-il des pages dont la balise meta description contient plus de 835 pixels?", category: 'Meta Description', notes: 'Description tronquée au-delà de 835px', issueMatchers: ['Meta description pixel width > 835px', 'Meta description pixel'], invertStatus: true },
    { id: 'Q21', question: "Y'a t-il des pages avec une balise meta description possédant moins de 70 caractères", category: 'Meta Description', notes: 'Description courte = message incomplet', issueMatchers: ['Meta description too short'], invertStatus: true },
    { id: 'Q22', question: "Est-ce que sur les pages les plus importantes, la balise Meta description contient le mot clé principal?", category: 'Meta Description', notes: 'Mot clé en gras dans les SERP', issueMatchers: ['Keyword not in meta description'], invertStatus: true },
    // Q23-Q26: H1 TAGS
    { id: 'Q23', question: "Y'a t-il des pages avec balises H1 manquantes ou vides?", category: 'H1', notes: 'H1 = titre principal de la page', issueMatchers: ['Missing H1 tag'], invertStatus: true },
    { id: 'Q24', question: "Y'a t-il des pages avec des balises H1 identiques / dupliquées", category: 'H1', notes: 'H1 unique pour chaque page', issueMatchers: ['Duplicate H1 tag'], invertStatus: true },
    { id: 'Q25', question: "Y'a t-il des pages avec balises H1 dépassant les 70 caractères", category: 'H1', notes: 'H1 trop long = dilution du message', issueMatchers: ['H1 too long'], invertStatus: true },
    { id: 'Q26', question: "Y'a t-il des pages contenant plusieurs balises H1", category: 'H1', notes: 'Un seul H1 par page (bonne pratique)', issueMatchers: ['Multiple H1 tags'], invertStatus: true },
    // Q27-Q30: H2 & STRUCTURE
    { id: 'Q27', question: "Y'a t-il des pages avec balises H2 manquantes ou vides qui devraient pourtant en tirer profit?", category: 'H2', notes: 'H2 structure le contenu pour les utilisateurs', issueMatchers: ['No H2 tags'], invertStatus: true },
    { id: 'Q28', question: "Y'a t-il des pages avec balises H2 dépassant les 70 caractères", category: 'H2', notes: 'H2 concis = meilleure lisibilité', issueMatchers: ['H2 too long'], invertStatus: true },
    { id: 'Q29', question: "Est-ce que les pages importantes sont bien structurées à l'aide des balises Hn?", category: 'Structure', notes: 'Hiérarchie H1 > H2 > H3 logique', issueMatchers: ['Poor Hn structure'], invertStatus: true },
    { id: 'Q30', question: "Y'a t-il des balises Hn de très petite taille?", category: 'Structure', notes: 'Taille de police lisible (min 14px)', issueMatchers: ['Small heading font'], invertStatus: true },
    // Q31-Q34: CONTENT & KEYWORDS
    { id: 'Q31', question: "Est-ce que sur les pages les plus importantes, le mot clé principal est inclus dans les 100 premiers mots de la page?", category: 'Contenu', notes: 'Mot clé tôt = signal de pertinence', issueMatchers: ['Keyword not in first 100 words'], invertStatus: true },
    { id: 'Q32', question: "Est-ce que sur les pages les plus importantes, le mot clé est inclus dans les 150 derniers mots?", category: 'Contenu', notes: 'Mot clé en conclusion = renforce le thème', issueMatchers: ['Keyword not in last 150 words'], invertStatus: true },
    { id: 'Q33', question: "Est-ce que sur les pages les plus importantes, le mot clé principal est inclus dans la balise H1?", category: 'Contenu', notes: 'Cohérence H1 et mot clé ciblé', issueMatchers: ['Keyword not in H1'], invertStatus: true },
    { id: 'Q34', question: "Est-ce que sur les pages les plus importantes, le mot clé principal est inclus dans au moins une balise H2?", category: 'Contenu', notes: 'H2 avec mot clé = structure SEO', issueMatchers: ['Keyword not in H2'], invertStatus: true },
    // Q35-Q36: STRUCTURED DATA
    { id: 'Q35', question: "Le site utilise t-il des données structurées?", category: 'Schema', notes: 'Rich snippets = meilleur CTR', issueMatchers: ['No structured data'], invertStatus: true },
    { id: 'Q36', question: "Y'a t-il des problèmes liés aux données structurées?", category: 'Schema', notes: 'Valider avec Google Rich Results Test', issueMatchers: ['Structured data errors'], invertStatus: true },
    // Q37-Q40: IMAGES
    { id: 'Q37', question: "Est-ce que le poids de toutes les images est inférieur à 100 ko?", category: 'Images', notes: 'Images légères = temps de chargement optimal', issueMatchers: ['images > 100KB', 'Large image'], invertStatus: true },
    { id: 'Q38', question: "Est-ce que sur les pages les plus importantes, les noms de chaque image décrivent bien les images?", category: 'Images', notes: 'Noms de fichiers descriptifs = SEO images', issueMatchers: ['Non-descriptive image names'], invertStatus: true },
    { id: 'Q39', question: "Est-ce que toutes les images utilisent des attributs ALT dans la balise img?", category: 'Images', notes: 'ALT obligatoire pour accessibilité et SEO', issueMatchers: ['images missing alt text', 'missing alt'], invertStatus: true },
    { id: 'Q40', question: "Est-ce que les attributs ALT sont bien traduits dans chaque langue?", category: 'Images', notes: 'ALT localisé pour sites multilingues', issueMatchers: ['ALT not translated', 'Alt text language mismatch'], invertStatus: true },
    // Q41: INTERNATIONALIZATION
    { id: 'Q41', question: "Est-ce que les URLs des pages localisées sont bien traduites?", category: 'International', notes: 'URLs traduites = meilleur SEO local', issueMatchers: ['URLs not translated', 'hreflang mismatch'], invertStatus: true },
    // Q42-Q44: ANALYTICS
    { id: 'Q42', question: "Est-ce que le code de suivi se trouve bien sur toutes les pages du site?", category: 'Analytics', notes: 'Tracking universel pour données complètes', issueMatchers: ['No Google Analytics'], invertStatus: true },
    { id: 'Q43', question: "Est-ce que le site utilise bien Universal Analytics (et non pas Google Analytics classique)?", category: 'Analytics', notes: 'GA4 recommandé (UA déprécié)', issueMatchers: ['Using Universal Analytics'], invertStatus: true },
    { id: 'Q44', question: "Est-ce que certains liens internes contiennent des URLs de campagne?", category: 'Analytics', notes: 'UTM sur liens internes = pollution des données', issueMatchers: ['UTM parameters', 'Campaign URLs'], invertStatus: true },
    // Q45-Q46: PERFORMANCE
    { id: 'Q45', question: "Est-ce que le score de vitesse Google Page Speed Insights (ordinateur) est supérieur à 90, pour les pages importantes?", category: 'Performance', notes: 'Score Desktop > 90 = bonne expérience', issueMatchers: ['PSI desktop score < 90'], invertStatus: true },
    { id: 'Q46', question: "Est-ce que le score de vitesse Google Page Speed Insights (mobile) est supérieur à 90, pour les pages importantes?", category: 'Performance', notes: 'Score Mobile > 90 = Mobile First Ready', issueMatchers: ['PSI mobile score < 90'], invertStatus: true },
    // Q47: SECURITY
    { id: 'Q47', question: "Est-ce que certains contenus ne sont pas sécurisés?", category: 'Sécurité', notes: 'HTTPS obligatoire, éviter mixed content', issueMatchers: ['Mixed content', 'Insecure content', 'HTTP resource'], invertStatus: true },
    // Q48-Q54: HTTP STATUS & REDIRECTIONS
    { id: 'Q48', question: "Y'a t-il des redirections 302 internes?", category: 'Statut HTTP', notes: '302 = temporaire, préférer 301 pour permanent', issueMatchers: ['302 redirect'], invertStatus: true },
    { id: 'Q49', question: "Y'a t-il des pages qui retournent un code 403?", category: 'Statut HTTP', notes: '403 = accès interdit, vérifier permissions', issueMatchers: ['403 Forbidden'], invertStatus: true },
    { id: 'Q50', question: "Y'a t-il des pages qui retournent un code 404?", category: 'Statut HTTP', notes: '404 = page introuvable, corriger liens cassés', issueMatchers: ['404 Not Found'], invertStatus: true },
    { id: 'Q51', question: "Y'a t-il des pages qui retournent un code 500?", category: 'Statut HTTP', notes: '500 = erreur serveur, investigation requise', issueMatchers: ['500 Server Error'], invertStatus: true },
    { id: 'Q52', question: "Y'a t-il des pages ne retournant aucune réponse (time-out)?", category: 'Statut HTTP', notes: 'Timeout = serveur trop lent ou inaccessible', issueMatchers: ['Page timeout', 'timeout'], invertStatus: true },
    { id: 'Q53', question: "Y'a t-il des chaines de redirection?", category: 'Statut HTTP', notes: 'Chaînes = perte de PageRank, simplifier', issueMatchers: ['Redirect chain', 'redirect chain'], invertStatus: true },
    { id: 'Q54', question: "Y'a t-il des redirections Meta Refresh utilisées?", category: 'Statut HTTP', notes: 'Meta refresh = mauvaise UX, utiliser 301', issueMatchers: ['Meta refresh redirect', 'meta refresh'], invertStatus: true },
    // Q55-Q70: GOOGLE SEARCH CONSOLE
    { id: 'Q55', question: "Est-ce que l'état de l'indexation montre des anomalies?", category: 'Indexation', notes: 'Vérifier Coverage Report dans GSC', issueMatchers: ['Indexing anomalies', 'Coverage state anomaly'], invertStatus: true },
    { id: 'Q56', question: "Est-ce que le fichier robots.txt possède des \"Erreurs\" ou \"Avertissements\"?", category: 'Robots.txt', notes: 'Tester robots.txt dans GSC', issueMatchers: ['Robots.txt errors', 'Robots.txt warnings'], invertStatus: true },
    { id: 'Q57', question: "Est-ce que le site possède des pages bloquées non intentionnellement par robots.txt?", category: 'Robots.txt', notes: 'Vérifier les règles de blocage', issueMatchers: ['Blocked by robots.txt'], invertStatus: true },
    { id: 'Q58', question: "Est-ce que le site possède des ressources non intentionnellement bloquées par robots.txt?", category: 'Robots.txt', notes: 'CSS/JS bloqués = rendu incomplet', issueMatchers: ['Resources blocked by robots.txt'], invertStatus: true },
    { id: 'Q59', question: "Le site rencontre t-il des erreurs d'exploration (Crawl)?", category: 'Exploration', notes: 'Crawl Errors Report dans GSC', issueMatchers: ['Crawl errors'], invertStatus: true },
    { id: 'Q60', question: "Est-ce que le site rencontre des anomalies au niveau statistiques de crawl par GoogleBot?", category: 'Exploration', notes: 'Crawl Stats Report dans GSC', issueMatchers: ['Crawl anomalies'], invertStatus: true },
    { id: 'Q61', question: "Est-ce que la/les sitemap(s) sont listées dans la Google Search Console?", category: 'Sitemaps', notes: 'Sitemaps Report dans GSC', issueMatchers: ['Sitemaps not listed', 'No sitemaps submitted'], invertStatus: true },
    { id: 'Q62', question: "Est-ce que la/les sitemap(s) possèdent des \"Erreurs\" ou \"avertissements\"?", category: 'Sitemaps', notes: 'Corriger erreurs de sitemap', issueMatchers: ['Sitemap errors', 'Sitemap warnings'], invertStatus: true },
    { id: 'Q63', question: "Y'a t'il des problèmes d'indexation pour ce(s) sous-domaine(s)?", category: 'Indexation', notes: 'Vérifier chaque propriété GSC', issueMatchers: ['Indexing issues', 'Coverage issues'], invertStatus: true },
    { id: 'Q64', question: "Est-ce qu'une propriété Google Search Console par site (donc par pays) a bien été créé?", category: 'Configuration GSC', notes: 'Une propriété GSC par domaine/pays', issueMatchers: ['GSC property not set'], invertStatus: true },
    { id: 'Q65', question: "Est-ce qu'un pays cible est défini dans Google Search Console pour chaque site?", category: 'International', notes: 'International Targeting dans GSC', issueMatchers: ['Target country not set', 'Country targeting missing'], invertStatus: true },
    { id: 'Q66', question: "Est-ce que Google Search Console a détecté des erreurs relatives à la balise Hreflang?", category: 'International', notes: 'International Targeting > Hreflang', issueMatchers: ['Hreflang errors'], invertStatus: true },
    { id: 'Q67', question: "Est-ce que le site est configuré dans Google Search Console?", category: 'Configuration GSC', notes: 'Vérification de propriété requise', issueMatchers: ['GSC not configured', 'GSC not verified', 'GSC property not set'], invertStatus: true },
    { id: 'Q68', question: "Est-ce que le site a reçu une pénalité de type \"Action manuelle\" par la Search Quality Team de Google?", category: 'Pénalités', notes: 'Manual Actions Report dans GSC', issueMatchers: ['Manual action penalty'], invertStatus: true },
    { id: 'Q69', question: "Est-ce que le site a des suggestions d'améliorations?", category: 'Améliorations', notes: 'PageSpeed/Core Web Vitals dans GSC', issueMatchers: ['Improvement suggestions'], invertStatus: true },
    { id: 'Q70', question: "Le site possède t-il des problèmes de sécurité?", category: 'Sécurité', notes: 'Security Issues Report dans GSC', issueMatchers: ['Security issues'], invertStatus: true },
];
/**
 * Extract on-page issues from crawl result
 * Covers all 50+ SEO audit questions
 */
export function extractOnPageIssues(crawlResult: any, siteUrl: string): any[] {
    const issues = [];
    const crawlDate = new Date().toISOString();
    // Build lookup maps for site-wide duplicate detection
    const titleCounts = new Map();
    const h1Counts = new Map();
    const metaDescCounts = new Map();
    // First pass: count duplicates
    for (const page of crawlResult.pages) {
        if (!page.contentType?.includes('text/html'))
            continue;
        // Track title duplicates (normalized)
        if (page.title) {
            const normalizedTitle = page.title.toLowerCase().trim();
            if (!titleCounts.has(normalizedTitle)) {
                titleCounts.set(normalizedTitle, []);
            }
            titleCounts.get(normalizedTitle).push(page.url);
        }
        // Track H1 duplicates (normalized)
        if (page.h1) {
            const normalizedH1 = page.h1.toLowerCase().trim();
            if (!h1Counts.has(normalizedH1)) {
                h1Counts.set(normalizedH1, []);
            }
            h1Counts.get(normalizedH1).push(page.url);
        }
        // Track meta description duplicates (normalized)
        if (page.metaDescription) {
            const normalizedDesc = page.metaDescription.toLowerCase().trim();
            if (!metaDescCounts.has(normalizedDesc)) {
                metaDescCounts.set(normalizedDesc, []);
            }
            metaDescCounts.get(normalizedDesc).push(page.url);
        }
    }
    // Second pass: extract issues
    for (const page of crawlResult.pages) {
        // Skip non-HTML pages
        if (!page.contentType?.includes('text/html'))
            continue;
        const baseIssue = {
            url: page.url,
            title: page.title || '',
            h1: page.h1 || '',
            h2: page.h2_1 || page.h2_2 || '',
            metaDescription: page.metaDescription || '',
            statusCode: page.statusCode,
            wordCount: page.wordCount,
            pageSize: page.pageSize,
            responseTime: page.responseTime,
            crawlDate,
            siteUrl,
            titlePixelWidth: page.titlePixelWidth,
            metaDescPixelWidth: page.metaDescriptionPixelWidth,
            h1Length: page.h1Length,
            h2Length: page.h2_1Length || page.h2_2Length,
            crawlDepth: page.crawlDepth,
            inlinks: page.inlinks,
            canonical: page.canonical,
            relNext: page.relNext,
            relPrev: page.relPrev,
            metaRobots: page.metaRobots,
            redirectType: page.redirectType,
            metaRefresh: page.metaRefresh,
            psiMobileScore: page.psi?.mobile.performance,
            psiDesktopScore: page.psi?.desktop.performance,
            hasCampaignUrls: page.hasCampaignUrls,
            analyticsType: getAnalyticsType(page),
            imageCount: page.imageCount,
            imagesMissingAlt: page.imagesMissingAlt,
            largeImages: countLargeImages(page.images),
            hasStructuredData: page.hasStructuredData,
            structuredDataErrors: page.structuredData?.filter((s: any) => !s.valid).map((s: any) => s.type),
        };
        // Check duplicate status
        const isDuplicateTitle = page.title && (titleCounts.get(page.title.toLowerCase().trim())?.length || 0) > 1;
        const isDuplicateH1 = page.h1 && (h1Counts.get(page.h1.toLowerCase().trim())?.length || 0) > 1;
        const isDuplicateMetaDesc = page.metaDescription && (metaDescCounts.get(page.metaDescription.toLowerCase().trim())?.length || 0) > 1;
        // =========================================
        // TITLE CHECKS
        // =========================================
        // Missing title
        if (!page.title || page.title.trim() === '') {
            issues.push({ ...baseIssue, issueType: 'Missing title tag', category: 'Title', severity: 'error' });
        }
        else {
            // Title too short (< 30 chars)
            if ((page.titleLength || 0) < 30) {
                issues.push({ ...baseIssue, issueType: 'Title too short (<30 chars)', category: 'Title', severity: 'warning' });
            }
            // Title too long (> 60 chars)
            if ((page.titleLength || 0) > 60) {
                issues.push({ ...baseIssue, issueType: 'Title too long (>60 chars)', category: 'Title', severity: 'warning' });
            }
            // Title pixel width > 512
            if ((page.titlePixelWidth || 0) > 512) {
                issues.push({ ...baseIssue, issueType: 'Title pixel width > 512px', category: 'Title', severity: 'warning' });
            }
            // Duplicate title
            if (isDuplicateTitle) {
                issues.push({ ...baseIssue, issueType: 'Duplicate title tag', category: 'Title', severity: 'error', isDuplicateTitle: true });
            }
        }
        // =========================================
        // META DESCRIPTION CHECKS
        // =========================================
        // Missing meta description
        if (!page.metaDescription || page.metaDescription.trim() === '') {
            issues.push({ ...baseIssue, issueType: 'Missing meta description', category: 'Meta Description', severity: 'error' });
        }
        else {
            // Meta description too short (< 70 chars - your threshold)
            if ((page.metaDescriptionLength || 0) < 70) {
                issues.push({ ...baseIssue, issueType: 'Meta description too short (<70 chars)', category: 'Meta Description', severity: 'warning' });
            }
            // Meta description too long (> 160 chars)
            if ((page.metaDescriptionLength || 0) > 160) {
                issues.push({ ...baseIssue, issueType: 'Meta description too long (>160 chars)', category: 'Meta Description', severity: 'warning' });
            }
            // Meta description pixel width > 835
            if ((page.metaDescriptionPixelWidth || 0) > 835) {
                issues.push({ ...baseIssue, issueType: 'Meta description pixel width > 835px', category: 'Meta Description', severity: 'warning' });
            }
            // Duplicate meta description
            if (isDuplicateMetaDesc) {
                issues.push({ ...baseIssue, issueType: 'Duplicate meta description', category: 'Meta Description', severity: 'error', isDuplicateMetaDesc: true });
            }
        }
        // =========================================
        // H1 CHECKS
        // =========================================
        // Missing H1
        if (!page.h1 || page.h1.trim() === '') {
            issues.push({ ...baseIssue, issueType: 'Missing H1 tag', category: 'H1', severity: 'error' });
        }
        else {
            // Multiple H1 tags
            if (page.headingCounts && page.headingCounts.h1Count > 1) {
                issues.push({ ...baseIssue, issueType: `Multiple H1 tags (${page.headingCounts.h1Count})`, category: 'H1', severity: 'warning' });
            }
            // H1 too long (> 70 chars)
            if ((page.h1Length || 0) > 70) {
                issues.push({ ...baseIssue, issueType: 'H1 too long (>70 chars)', category: 'H1', severity: 'warning' });
            }
            // Duplicate H1
            if (isDuplicateH1) {
                issues.push({ ...baseIssue, issueType: 'Duplicate H1 tag', category: 'H1', severity: 'warning', isDuplicateH1: true });
            }
        }
        // =========================================
        // H2 CHECKS
        // =========================================
        // No H2 tags
        if (!page.h2_1 && !page.h2_2) {
            issues.push({ ...baseIssue, issueType: 'No H2 tags', category: 'H2', severity: 'warning' });
        }
        else {
            // H2 too long (> 70 chars)
            const maxH2Length = Math.max(page.h2_1Length || 0, page.h2_2Length || 0);
            if (maxH2Length > 70) {
                issues.push({ ...baseIssue, issueType: 'H2 too long (>70 chars)', category: 'H2', severity: 'warning' });
            }
        }
        // =========================================
        // CONTENT CHECKS
        // =========================================
        // Low word count (< 300)
        if ((page.wordCount || 0) < 300) {
            issues.push({ ...baseIssue, issueType: `Low word count (${page.wordCount})`, category: 'Content', severity: 'warning' });
        }
        // =========================================
        // SITE STRUCTURE / NAVIGATION CHECKS
        // =========================================
        // Orphan page (0 inlinks)
        if ((page.inlinks || 0) === 0) {
            issues.push({ ...baseIssue, issueType: 'Orphan page (no internal links)', category: 'Site Structure', severity: 'error' });
        }
        // Deep page (> 3 clicks from homepage)
        if ((page.crawlDepth || 0) > 3) {
            issues.push({ ...baseIssue, issueType: `Deep page (${page.crawlDepth} clicks from home)`, category: 'Site Structure', severity: 'warning' });
        }
        // =========================================
        // PAGINATION CHECKS
        // =========================================
        // Has pagination - check for issues
        if (page.relNext || page.relPrev) {
            // Check if canonical is self-referencing for paginated pages
            if (page.canonical && page.canonical !== page.url) {
                // This could be OK for some pagination strategies, flag as info
                issues.push({ ...baseIssue, issueType: 'Paginated page with non-self canonical', category: 'Pagination', severity: 'info' });
            }
            // Check meta robots for noindex on paginated pages
            if (page.metaRobots && page.metaRobots.toLowerCase().includes('noindex')) {
                issues.push({ ...baseIssue, issueType: 'Paginated page with noindex', category: 'Pagination', severity: 'warning' });
            }
            // Check if both prev/next exist for middle pages
            // (Only having one is normal for first/last, so just note it)
            if ((page.relNext && !page.relPrev) || (!page.relNext && page.relPrev)) {
                // This is normal for first/last page, so skip
            }
        }
        // =========================================
        // TECHNICAL / STATUS CODE CHECKS
        // =========================================
        // 403 Forbidden
        if (page.statusCode === 403) {
            issues.push({ ...baseIssue, issueType: '403 Forbidden', category: 'Technical', severity: 'error' });
        }
        // 404 Not Found
        if (page.statusCode === 404) {
            issues.push({ ...baseIssue, issueType: '404 Not Found', category: 'Technical', severity: 'error' });
        }
        // 500 Server Error
        if (page.statusCode === 500) {
            issues.push({ ...baseIssue, issueType: '500 Server Error', category: 'Technical', severity: 'error' });
        }
        // Broken pages (4xx/5xx) - general
        if (page.statusCode >= 400 && page.statusCode !== 403 && page.statusCode !== 404 && page.statusCode !== 500) {
            issues.push({ ...baseIssue, issueType: `Broken page (${page.statusCode})`, category: 'Technical', severity: 'error' });
        }
        // Redirects
        if (page.statusCode >= 300 && page.statusCode < 400) {
            issues.push({ ...baseIssue, issueType: `Redirect (${page.statusCode})`, category: 'Technical', severity: 'info' });
        }
        // 302 redirect (should be 301 for SEO)
        if (page.statusCode === 302 || page.redirectType === '302' || page.redirectType?.includes('302')) {
            issues.push({ ...baseIssue, issueType: '302 redirect', category: 'Technical', severity: 'warning' });
        }
        // Meta refresh redirect
        if (page.metaRefresh && page.metaRefresh.trim() !== '') {
            issues.push({ ...baseIssue, issueType: 'Meta refresh redirect', category: 'Technical', severity: 'warning' });
        }
        // Redirect chains
        if (page.redirectType?.toLowerCase().includes('chain')) {
            issues.push({ ...baseIssue, issueType: 'Redirect chain', category: 'Technical', severity: 'warning' });
        }
        // Timeout (no response)
        if (page.statusCode === 0 || page.status?.toLowerCase().includes('timeout')) {
            issues.push({ ...baseIssue, issueType: 'Page timeout', category: 'Technical', severity: 'error' });
        }
        // =========================================
        // PERFORMANCE CHECKS
        // =========================================
        // Large page size (> 500KB)
        if ((page.pageSize || 0) > 500000) {
            issues.push({ ...baseIssue, issueType: `Large page size (${Math.round((page.pageSize || 0) / 1024)}KB)`, category: 'Performance', severity: 'warning' });
        }
        // Slow response time (> 2s)
        if ((page.responseTime || 0) > 2000) {
            issues.push({ ...baseIssue, issueType: `Slow response time (${Math.round(page.responseTime || 0)}ms)`, category: 'Performance', severity: 'warning' });
        }
        // PSI mobile score < 90
        if (page.psi?.mobile.performance !== undefined && page.psi.mobile.performance < 90) {
            issues.push({ ...baseIssue, issueType: `PSI mobile score < 90 (${page.psi.mobile.performance})`, category: 'Performance', severity: 'warning' });
        }
        // PSI desktop score < 90
        if (page.psi?.desktop.performance !== undefined && page.psi.desktop.performance < 90) {
            issues.push({ ...baseIssue, issueType: `PSI desktop score < 90 (${page.psi.desktop.performance})`, category: 'Performance', severity: 'warning' });
        }
        // =========================================
        // IMAGE CHECKS
        // =========================================
        // Images missing alt text
        if ((page.imagesMissingAlt || 0) > 0) {
            issues.push({ ...baseIssue, issueType: `${page.imagesMissingAlt} images missing alt text`, category: 'Images', severity: 'error' });
        }
        // Large images (> 100KB each)
        const largeImgCount = countLargeImages(page.images);
        if (largeImgCount > 0) {
            issues.push({ ...baseIssue, issueType: `${largeImgCount} images > 100KB`, category: 'Images', severity: 'warning' });
        }
        // =========================================
        // STRUCTURED DATA CHECKS
        // =========================================
        // No structured data
        if (!page.hasStructuredData) {
            issues.push({ ...baseIssue, issueType: 'No structured data', category: 'Schema', severity: 'info' });
        }
        // Structured data errors
        const schemaErrors = page.structuredData?.filter((s: any) => !s.valid) || [];
        if (schemaErrors.length > 0) {
            issues.push({ ...baseIssue, issueType: `Structured data errors (${schemaErrors.map((s: any) => s.type).join(', ')})`, category: 'Schema', severity: 'warning' });
        }
        // =========================================
        // ANALYTICS CHECKS
        // =========================================
        // No Google Analytics
        if (!page.analytics?.hasGoogleAnalytics) {
            issues.push({ ...baseIssue, issueType: 'No Google Analytics', category: 'Analytics', severity: 'warning' });
        }
        else {
            // Using Universal Analytics (UA) instead of GA4
            if (page.analytics.hasUniversalAnalytics && !page.analytics.hasGA4) {
                issues.push({ ...baseIssue, issueType: 'Using Universal Analytics (should migrate to GA4)', category: 'Analytics', severity: 'warning' });
            }
        }
        // =========================================
        // INTERNAL LINK QUALITY CHECKS
        // =========================================
        // Campaign URLs (UTM) in internal links
        if (page.hasCampaignUrls) {
            issues.push({ ...baseIssue, issueType: `${page.campaignUrlCount} internal links with UTM parameters`, category: 'Links', severity: 'warning' });
        }
        // =========================================
        // CANONICAL CHECKS (for faceted navigation)
        // =========================================
        // If page has query parameters but no canonical, flag it
        const urlObj = new URL(page.url);
        if (urlObj.search && !page.canonical) {
            issues.push({ ...baseIssue, issueType: 'URL with parameters but no canonical', category: 'Canonical', severity: 'warning' });
        }
        // =========================================
        // ARCHITECTURE & NAVIGATION CHECKS
        // =========================================
        // URL navigation mismatch - check if URL structure doesn't match expected patterns
        const pathSegments = urlObj.pathname.split('/').filter(s => s.length > 0);
        if (pathSegments.length > 2) {
            // Check if deeply nested URLs have corresponding navigation indicators
            const hasBreadcrumbIndicator = page.h1 && pathSegments.some(seg => page.h1.toLowerCase().includes(seg.toLowerCase().replace(/-/g, ' ')));
            if (!hasBreadcrumbIndicator && pathSegments.length > 3) {
                issues.push({ ...baseIssue, issueType: 'URL navigation mismatch', category: 'Architecture', severity: 'info' });
            }
        }
        // Low value page detection
        const isLowValue = (page.wordCount || 0) < 100 &&
            (page.inlinks || 0) < 2 &&
            !page.title?.includes('Contact') &&
            !page.title?.includes('Mention');
        if (isLowValue) {
            issues.push({ ...baseIssue, issueType: 'Low value page', category: 'Architecture', severity: 'info' });
        }
        // Faceted navigation without canonical
        if (urlObj.search && Object.keys(urlObj.searchParams).length > 2 && !page.canonical) {
            issues.push({ ...baseIssue, issueType: 'Faceted navigation without canonical', category: 'Architecture', severity: 'warning' });
        }
        // =========================================
        // PAGINATION CHECKS (Extended)
        // =========================================
        // Check for pagination patterns
        const isPaginated = page.relNext || page.relPrev ||
            /page=\d+|p=\d+|page\/\d+/.test(page.url);
        if (isPaginated) {
            // Paginated page non-200
            if (page.statusCode !== 200) {
                issues.push({ ...baseIssue, issueType: 'Paginated page non-200', category: 'Pagination', severity: 'error' });
            }
            // Pagination order issue (check for skipped pages via URL pattern)
            const pageMatch = page.url.match(/[&?](page|p)=(\d+)/);
            if (pageMatch) {
                const pageNum = parseInt(pageMatch[2], 10);
                if (pageNum > 1 && !page.relPrev) {
                    issues.push({ ...baseIssue, issueType: 'Pagination order issue - missing prev', category: 'Pagination', severity: 'warning' });
                }
            }
            // Paginated page non-self canonical
            if (page.canonical && page.canonical !== page.url) {
                issues.push({ ...baseIssue, issueType: 'Paginated page non-self canonical', category: 'Pagination', severity: 'info' });
            }
            // Paginated page noindex
            if (page.metaRobots && page.metaRobots.toLowerCase().includes('noindex')) {
                issues.push({ ...baseIssue, issueType: 'Paginated page noindex', category: 'Pagination', severity: 'warning' });
            }
        }
        // Q6: Check for multiple prev/next links
        if (page.relNext && page.relNext.includes(',') || page.relPrev && page.relPrev.includes(',')) {
            issues.push({ ...baseIssue, issueType: 'Multiple prev/next links detected', category: 'Pagination', severity: 'warning' });
        }
        // =========================================
        // KEYWORD OPTIMIZATION CHECKS
        // =========================================
        // Extract primary keyword from title (first significant word/phrase)
        const extractKeyword = (title: string): string | null => {
            if (!title)
                return null;
            // Remove common words and get the first meaningful phrase
            const stopWords = ['le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'en', 'à', 'au', 'aux', 'pour', 'par', 'sur', 'dans', 'avec', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'];
            const words = title.split(/[\s\-|:]+/).filter((w: string) => w.length > 2 && !stopWords.includes(w.toLowerCase()));
            return words.length > 0 ? words[0].toLowerCase() : null;
        };
        const primaryKeyword = extractKeyword(page.title || '');
        if (primaryKeyword && (page.inlinks || 0) >= 10) {
            // Only check keyword optimization for important pages (high inlinks)
            // Keyword not in title
            if (page.title && !page.title.toLowerCase().includes(primaryKeyword)) {
                issues.push({ ...baseIssue, issueType: 'Keyword not in title', category: 'Mots clés', severity: 'warning' });
            }
            // Keyword not at start of title
            if (page.title) {
                const titleStart = page.title.substring(0, Math.floor(page.title.length / 3)).toLowerCase();
                if (!titleStart.includes(primaryKeyword)) {
                    issues.push({ ...baseIssue, issueType: 'Keyword not at start of title', category: 'Mots clés', severity: 'info' });
                }
            }
            // Keyword not in meta description
            if (page.metaDescription && !page.metaDescription.toLowerCase().includes(primaryKeyword)) {
                issues.push({ ...baseIssue, issueType: 'Keyword not in meta description', category: 'Mots clés', severity: 'warning' });
            }
            // Keyword not in H1
            if (page.h1 && !page.h1.toLowerCase().includes(primaryKeyword)) {
                issues.push({ ...baseIssue, issueType: 'Keyword not in H1', category: 'Mots clés', severity: 'warning' });
            }
            // Keyword not in H2
            const h2Text = (page.h2_1 || '') + ' ' + (page.h2_2 || '');
            if (h2Text.trim() && !h2Text.toLowerCase().includes(primaryKeyword)) {
                issues.push({ ...baseIssue, issueType: 'Keyword not in H2', category: 'Mots clés', severity: 'info' });
            }
        }
        // Q31 & Q32: Keyword position in content (if we have content data)
        if (primaryKeyword && page.textContent) {
            const contentLower = page.textContent.toLowerCase();
            const first100Words = contentLower.split(/\s+/).slice(0, 100).join(' ');
            const last150Words = contentLower.split(/\s+/).slice(-150).join(' ');
            if (!first100Words.includes(primaryKeyword)) {
                issues.push({ ...baseIssue, issueType: 'Keyword not in first 100 words', category: 'Mots clés', severity: 'warning' });
            }
            if (!last150Words.includes(primaryKeyword)) {
                issues.push({ ...baseIssue, issueType: 'Keyword not in last 150 words', category: 'Mots clés', severity: 'info' });
            }
        }
        // =========================================
        // LINK JUICE DISTRIBUTION CHECK
        // =========================================
        // Check if page with high inlinks has proper SEO elements
        if ((page.inlinks || 0) > 50 && ((page.wordCount || 0) < 200 || !page.h1)) {
            issues.push({ ...baseIssue, issueType: 'Link juice distribution issue - high links but poor content', category: 'Mots clés', severity: 'warning' });
        }
        // =========================================
        // HN STRUCTURE CHECKS
        // =========================================
        // Poor Hn structure - missing H1 or H2 on content pages
        if ((page.wordCount || 0) > 300) {
            if (!page.h1 && !page.h2_1) {
                issues.push({ ...baseIssue, issueType: 'Poor Hn structure - no headings', category: 'Structure', severity: 'warning' });
            }
        }
        // Q30: Small Hn font size - check inline styles
        if (page.h1Style && /font-size:\s*(\d+)(px|pt)/i.test(page.h1Style)) {
            const match = page.h1Style.match(/font-size:\s*(\d+)(px|pt)/i);
            if (match && parseInt(match[1]) < 14) {
                issues.push({ ...baseIssue, issueType: 'Small Hn font size (H1 < 14px)', category: 'Structure', severity: 'info' });
            }
        }
        // Small Hn font size - detected via inline style (if available)
        // Note: Full detection requires browser rendering, this is a best-effort check
        // This would need CSS analysis which Screaming Frog may not capture fully
        // For now, we skip this as it requires visual/CSS analysis
        // =========================================
        // IMAGE DESCRIPTIVE NAMES CHECK
        // =========================================
        if (page.images && page.images.length > 0) {
            const nonDescriptivePatterns = /^\d+|^img\d?|^image\d?|^photo\d?|^\w{1,3}\d+\.(jpg|png|gif|webp)$/i;
            const nonDescriptiveImages = page.images.filter((img: any) => {
                const filename = img.src?.split('/').pop()?.split('?')[0] || '';
                return nonDescriptivePatterns.test(filename);
            });
            if (nonDescriptiveImages.length > 0) {
                issues.push({ ...baseIssue, issueType: `${nonDescriptiveImages.length} Non-descriptive image names`, category: 'Images', severity: 'info' });
            }
        }
        // =========================================
        // INTERNATIONALIZATION CHECKS
        // =========================================
        // Check for hreflangs/alternate links - indicates multilingual site
        // For automated detection, we check if the site has hreflangs but mixed language patterns
        if (page.hreflangs && page.hreflangs.length > 0) {
            // Site has internationalization - check for issues
            const hasMixedLangUrls = page.hreflangs.some((h: any) => {
                const langCode = h.hreflang?.split('-')[0]?.toLowerCase();
                const urlLangPattern = new RegExp(`/${langCode}/`, 'i');
                return langCode && !urlLangPattern.test(h.href || '');
            });
            if (hasMixedLangUrls) {
                issues.push({ ...baseIssue, issueType: 'URLs not translated - hreflang mismatch', category: 'Internationalisation', severity: 'warning' });
            }
        }
    // Q6: Multiple prev/next links detection
    // Check for multiple rel next or rel prev links
    // (This would be extracted from crawl data if available)
    if (page.relNextLinks && Array.isArray(page.relNextLinks) && page.relNextLinks.length > 1) {
        issues.push({ ...baseIssue, issueType: 'Multiple prev/next links detected', category: 'Pagination', severity: 'info' });
    }
    // Q40: ALT not translated - check for images with alt text not matching page language
    if (page.images && page.images.length > 0 && page.hreflangs && page.hreflangs.length > 0) {
        const pageLang = page.hreflangs[0]?.hreflang?.split('-')[0]?.toLowerCase();
        if (pageLang) {
            const altsNotMatching = page.images.filter((img: any) => {
                const alt = img.alt || '';
                // Check if alt text appears to be in a a different language
                // For French pages, check for French-specific characters
                if (pageLang === 'fr' && alt && !/[\x00-\x7F]/.test(alt)) {
                    return true;
                }
                // For English pages, check for non-English characters
                if (pageLang === 'en' && alt && /[\x00-\x7F]/.test(alt)) {
                    return true;
                }
                return false;
            });
            if (altsNotMatching.length > 0) {
                issues.push({ ...baseIssue, issueType: 'ALT not translated - alt text language mismatch', category: 'Images', severity: 'info' });
            }
        }
    }
    // Q47: Mixed content / HTTP on HTTPS pages
    if (page.url?.startsWith('https://') && page.html) {
        const httpResourcePatterns = [
            /src=["']http:/,
            /href=["']http:/,
            /<iframe[^>]*src=["']http:/,
            /<script[^>]*src=["']http:/,
            /<link[^>]*href=["']http:/,
        ];
        const hasMixedContent = httpResourcePatterns.some(pattern => pattern.test(page.html));
        if (hasMixedContent) {
            issues.push({ ...baseIssue, issueType: 'Insecure HTTP resource on HTTPS page', category: 'Sécurité', severity: 'warning' });
        }
        }
    }

    return issues;
}


export function generateAuditChecklist(issues: any[]): any[] {
    const rows: any[] = [];
    for (const question of AUDIT_QUESTIONS) {
        const matchingIssues = issues.filter(issue => 
            question.issueMatchers.some(matcher => 
                issue.issueType.toLowerCase().includes(matcher.toLowerCase())
            )
        );
        const hasIssues = matchingIssues.length > 0;
        const status = question.invertStatus !== false
            ? (hasIssues ? 'Échoué' : 'Réussi')
            : (hasIssues ? 'Réussi' : 'Échoué');
        // Generate notes: use question notes if no issues, or URL count if issues found
        let notes = '';
        if (hasIssues) {
            const uniqueUrls = new Set(matchingIssues.map(i => i.url)).size;
            notes = `${uniqueUrls} URL(s) concernée(s)`;
        } else {
            // Use the predefined notes from the question
            notes = question.notes || '';
        }
        rows.push({
            numero: rows.length + 1,
            actif: true,
            question: question.question,
            statut: status,
            assigne: '',
            outil: /^Q(5[5-9]|6[0-9]|70)$/.test(question.id) ? 'Google Search Console' : 'Screaming Frog',
            notes,
            categorie: question.category,
            urlImpactees: matchingIssues.length,
        });
    }
    return rows;
}
/**
 * Export audit checklist to CSV file
 */
export function exportChecklistToCSV(checklist: any[], outputPath: string): void {
    const headers = ['N°', 'Actif', 'Question', 'Statut', 'Assigné', 'Outil', 'Notes', 'Catégorie', 'URLs Impactées'];
    const rows = checklist.map((row: any) => [
        row.numero,
        row.actif ? 'TRUE' : 'FALSE',
        `"${row.question.replace(/"/g, '""')}"`,
        row.statut,
        row.assigne,
        row.outil,
        `"${row.notes.replace(/"/g, '""')}"`,
        row.categorie,
        row.urlImpactees || 0,
    ]);
    const csv = [headers.join(';'), ...rows.map((r: any) => r.join(';'))].join('\n');
    // Add BOM for Excel to recognize UTF-8
    fs.writeFileSync(outputPath, '\uFEFF' + csv, 'utf-8');
    console.log(`[Checklist] Exported to ${outputPath}`);
}
/**
 * Get analytics type string
 */
function getAnalyticsType(page: any): string {
    if (!page.analytics?.hasGoogleAnalytics)
        return 'None';
    const types = [];
    if (page.analytics.hasGA4)
        types.push('GA4');
    if (page.analytics.hasUniversalAnalytics)
        types.push('UA');
    if (page.analytics.hasGTM)
        types.push('GTM');
    return types.join(', ') || 'GA';
}
/**
 * Count large images (> 100KB)
 */
function countLargeImages(images: any[]): number {
    if (!images)
        return 0;
    return images.filter((img: any) => (img.fileSize || 0) > 102400).length;
}
/**
 * Convert issues to sheet rows
 */
export function issuesToSheetRows(issues: any[]): any[] {
    return issues.map((issue: any) => ({
        'URL': issue.url,
        'Issue Type': issue.issueType,
        'Category': issue.category,
        'Severity': issue.severity.toUpperCase(),
        'Title': issue.title || '',
        'Title Length': String(issue.title?.length || ''),
        'Title Pixels': String(issue.titlePixelWidth || ''),
        'H1': (issue.h1 || '').substring(0, 50),
        'H1 Length': String(issue.h1Length || ''),
        'H2': (issue.h2 || '').substring(0, 50),
        'H2 Length': String(issue.h2Length || ''),
        'Meta Description': (issue.metaDescription || '').substring(0, 100),
        'Meta Desc Length': String(issue.metaDescription?.length || ''),
        'Meta Desc Pixels': String(issue.metaDescPixelWidth || ''),
        'Status Code': String(issue.statusCode),
        'Word Count': String(issue.wordCount || ''),
        'Page Size': issue.pageSize ? `${Math.round(issue.pageSize / 1024)}KB` : '',
        'Response Time': issue.responseTime ? `${Math.round(issue.responseTime)}ms` : '',
        'Crawl Depth': String(issue.crawlDepth || ''),
        'Inlinks': String(issue.inlinks || ''),
        'Canonical': (issue.canonical || '').substring(0, 80),
        'Rel Next': issue.relNext ? 'Yes' : '',
        'Rel Prev': issue.relPrev ? 'Yes' : '',
        'Meta Robots': issue.metaRobots || '',
        'Redirect Type': issue.redirectType || '',
        'Meta Refresh': issue.metaRefresh ? 'Yes' : '',
        'PSI Mobile': issue.psiMobileScore !== undefined ? String(issue.psiMobileScore) : '',
        'PSI Desktop': issue.psiDesktopScore !== undefined ? String(issue.psiDesktopScore) : '',
        'Duplicate Title': issue.isDuplicateTitle ? 'Yes' : '',
        'Duplicate H1': issue.isDuplicateH1 ? 'Yes' : '',
        'Duplicate Meta Desc': issue.isDuplicateMetaDesc ? 'Yes' : '',
        'Campaign URLs': issue.hasCampaignUrls ? 'Yes' : '',
        'Analytics Type': issue.analyticsType || '',
        'Image Count': String(issue.imageCount || ''),
        'Images Missing Alt': String(issue.imagesMissingAlt || ''),
        'Large Images (>100KB)': String(issue.largeImages || ''),
        'Structured Data': issue.hasStructuredData ? 'Yes' : 'No',
        'Schema Errors': (issue.structuredDataErrors || []).join(', '),
        'Crawl Date': issue.crawlDate.split('T')[0],
        'Site URL': issue.siteUrl,
    }));
}
/**
 * Convert checklist rows to sheet format
 */
export function checklistToSheetRows(checklist: any[]): any[] {
    return checklist.map((row: any) => ({
        'N°': row.numero,
        'Actif': row.actif,
        'Question': row.question,
        'Statut': row.statut,
        'Assigné': row.assigne,
        'Outil': row.outil,
        'Notes': row.notes,
        'Catégorie': row.categorie,
    }));
}

const SEVERITY_ORDER: Record<string, number> = { 'error': 3, 'critical': 3, 'warning': 2, 'info': 1, 'Échoué': 3 };

/**
 * Group issues by URL with concatenated problem list
 * One row per URL instead of one row per issue
 */
export function issuesToGroupedRows(issues: any[]): any[] {
    const grouped = new Map<string, { issues: string[]; categories: Set<string>; severity: number; title: string; statusCode: number; h1: string }>();

    for (const issue of issues) {
        if (!grouped.has(issue.url)) {
            grouped.set(issue.url, {
                issues: [],
                categories: new Set(),
                severity: 0,
                title: issue.title || '',
                statusCode: issue.statusCode,
                h1: issue.h1 || '',
            });
        }
        const entry = grouped.get(issue.url)!;
        entry.issues.push(issue.issueType);
        if (issue.category) entry.categories.add(issue.category);
        const sev = SEVERITY_ORDER[issue.severity?.toLowerCase()] || 0;
        if (sev > entry.severity) entry.severity = sev;
    }

    const severityLabels: Record<number, string> = { 3: 'CRITIQUE', 2: 'AVERTISSEMENT', 1: 'INFO' };

    return Array.from(grouped.entries()).map(([url, data]) => ({
        'URL': url,
        'Nb Problèmes': data.issues.length,
        'Problèmes': [...new Set(data.issues)].join(', '),
        'Catégories': [...data.categories].join(', '),
        'Sévérité max': severityLabels[data.severity] || '',
        'Code HTTP': data.statusCode,
        'Balise TITLE': data.title,
    }));
}

/**
 * Convert crawl pages to sheet rows for Pages sheet
 * SF data + GSC traffic
 */
export function pagesToSheetRows(pages: any[], gscAnalytics?: Map<string, { clicks: number }>): any[] {
    return pages.map((page: any) => ({
        'Pages du site': page.url,
        'Code HTTP': page.statusCode || '',
        'Balise TITLE': page.title || '',
        'Meta Robots': page.metaRobots || '',
        'URL Canonique': page.canonical || '',
        'rel="next"': page.relNext || '',
        'rel="prev"': page.relPrev || '',
        'Profondeur': page.crawlDepth ?? '',
        'Liens internes entrants': page.inlinks ?? '',
        'Trafic organique': gscAnalytics?.get(page.url)?.clicks ?? '',
    }));
}
/**
 * Convert problem images (missing alt, too large, non-descriptive names) to sheet rows
 * Uses top-level images array from crawl result (SFCrawlResult.images)
 */
export function problemImagesToSheetRows(images: any[]): any[] {
    const problemImages: any[] = [];
    const nonDescriptivePatterns = /^\d+|^img\d?|^image\d?|^photo\d?|^\w{1,3}\d+\.(jpg|png|gif|webp)$/i;

    for (const img of images) {
        const problems: string[] = [];

        if (!img.alt || img.alt.trim() === '') {
            problems.push('ALT manquant');
        }
        if (img.fileSize && img.fileSize > 102400) {
            problems.push(`Poids > 100 Ko (${Math.round(img.fileSize / 1024)} Ko)`);
        }
        const filename = img.src?.split('/').pop()?.split('?')[0] || '';
        if (nonDescriptivePatterns.test(filename)) {
            problems.push('Nom non descriptif');
        }

        if (problems.length > 0) {
            problemImages.push({
                'URL de l\'image': img.src || '',
                'Problème(s)': problems.join(', '),
                'Texte ALT': img.alt || '(vide)',
                'Poids (octets)': img.fileSize ?? '',
                'Poids (Ko)': img.fileSize ? Math.round(img.fileSize / 1024) : '',
                'Largeur': img.width ?? '',
                'Hauteur': img.height ?? '',
                'Format': img.format || '',
            });
        }
    }

    console.log(`[Sheets] problemImagesToSheetRows: Found ${problemImages.length} problem images out of ${images.length} total`);
    return problemImages;
}

/**
 * Convert crawl images to sheet rows for Images sheet
 * Uses top-level images array from crawl result (SFCrawlResult.images)
 */
export function imagesToSheetRows(images: any[]): any[] {
    console.log(`[Sheets] imagesToSheetRows: Processing ${images.length} images`);
    
    return images.map((img: any) => ({
        'URL des images': img.src || '',
        'Poids de l\'image (octets)': img.fileSize || '',
    }));
}

/**
 * HTTP Status descriptions
 */
const HTTP_STATUS_DESCRIPTIONS: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found (Temporary Redirect)',
    303: 'See Other',
    304: 'Not Modified',
    307: 'Temporary Redirect',
    308: 'Permanent Redirect',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    408: 'Request Timeout',
    409: 'Conflict',
    410: 'Gone',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    501: 'Not Implemented',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
};

/**
 * Get human-readable status description
 */
function getStatusDescription(statusCode: number, statusText?: string): string {
    if (statusText) return statusText.toUpperCase();
    return HTTP_STATUS_DESCRIPTIONS[statusCode] || 'Unknown';
}

/**
 * Convert problem pages (non-200 status codes) to sheet rows for Problèmes techniques sheet
 */
export function problemsToSheetRows(pages: any[]): any[] {
    const problemPages = pages.filter((page: any) => {
        const code = page.statusCode || page.status;
        // Include redirects (3xx), client errors (4xx), server errors (5xx), and timeouts/unknown (0)
        return code && code !== 200;
    });
    
    console.log(`[Sheets] problemsToSheetRows: Found ${problemPages.length} pages with problems out of ${pages.length} total`);
    
    return problemPages.map((page: any) => ({
        'URL de la page': page.url,
        'Code http': page.statusCode || page.status || 0,
        'Status': getStatusDescription(page.statusCode || page.status, page.status),
    }));
}

/**
 * Convert 404 pages to sheet rows for URLs 404 sheet
 */
export function fourOhFourToSheetRows(pages: any[]): any[] {
    const notFoundPages = pages.filter((page: any) => {
        const code = page.statusCode || page.status;
        return code === 404;
    });

    console.log(`[Sheets] fourOhFourToSheetRows: Found ${notFoundPages.length} 404 pages out of ${pages.length} total`);

    return notFoundPages.map((page: any) => ({
        'URL': page.url,
        'Code HTTP': 404,
        'Balise TITLE': page.title || '',
        'Meta Robots': page.metaRobots || '',
        'Profondeur': page.crawlDepth ?? '',
        'Liens internes entrants': page.inlinks ?? '',
    }));
}

/**
 * Google Sheets Service
 */
export class GoogleSheetsService {
    sheets: any;
    private config: any = null;

    constructor() {
        this.loadConfig();
    }

    loadConfig() {
        const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
        const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n');
        const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
        if (clientEmail && privateKey && spreadsheetId) {
            this.config = {
                credentials: {
                    client_email: clientEmail,
                    private_key: privateKey,
                },
                spreadsheetId,
                sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || 'Sheet1',
            };
        }
    }
    isConfigured() {
        // Check if either service account or OAuth is available
        const hasServiceAccount = this.config !== null;
        const hasOAuth = oauthService.isConfigured() && oauthService.isAuthenticated();
        return hasServiceAccount || hasOAuth;
    }
    
    isOAuthMode(): boolean {
        return oauthService.isConfigured() && oauthService.isAuthenticated();
    }
    
    async getAuth() {
        // Prefer OAuth if available and authenticated
        if (oauthService.isConfigured() && oauthService.isAuthenticated()) {
            const oauth2Client = oauthService.getOAuth2Client();
            if (oauth2Client) {
                // Refresh token if needed
                await oauthService.refreshAccessToken();
                return oauth2Client;
            }
        }
        
        // Fall back to service account
        if (!this.config) {
            throw new Error('Google Sheets not configured. Set GOOGLE_SHEETS_* environment variables or complete OAuth flow.');
        }
        const auth = new google.auth.JWT({
            email: this.config.credentials.client_email,
            key: this.config.credentials.private_key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file'],
        });
        await auth.authorize();
        return auth;
    }
    async initializeClient() {
        const auth = await this.getAuth();
        this.sheets = google.sheets({ version: 'v4', auth });
    }
    /**
     * Append rows to a sheet
     */
    async appendRows(rows: any[], sheetName?: string): Promise<{ success: boolean; updatedRange?: string; updatedRows?: number; error?: string }> {
        if (!this.sheets) {
            await this.initializeClient();
        }
        const targetSheet = sheetName || this.config?.sheetName || 'Sheet1';
        // Convert rows to values array - ALL COLUMNS
        const values = rows.map((row: any) => [
            row['URL'],
            row['Issue Type'],
            row['Category'],
            row['Severity'],
            row['Title'],
            row['Title Length'],
            row['Title Pixels'],
            row['H1'],
            row['H1 Length'],
            row['H2'],
            row['H2 Length'],
            row['Meta Description'],
            row['Meta Desc Length'],
            row['Meta Desc Pixels'],
            row['Status Code'],
            row['Word Count'],
            row['Page Size'],
            row['Response Time'],
            row['Crawl Depth'],
            row['Inlinks'],
            row['Canonical'],
            row['Rel Next'],
            row['Rel Prev'],
            row['Meta Robots'],
            row['Redirect Type'],
            row['Meta Refresh'],
            row['PSI Mobile'],
            row['PSI Desktop'],
            row['Duplicate Title'],
            row['Duplicate H1'],
            row['Duplicate Meta Desc'],
            row['Campaign URLs'],
            row['Analytics Type'],
            row['Image Count'],
            row['Images Missing Alt'],
            row['Large Images (>100KB)'],
            row['Structured Data'],
            row['Schema Errors'],
            row['Crawl Date'],
            row['Site URL'],
        ]);
        try {
            const response = await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.config?.spreadsheetId,
                range: `${targetSheet}!A:A`,
                valueInputOption: 'USER_ENTERED',
                insertDataOption: 'INSERT_ROWS',
                requestBody: {
                    values,
                },
            });
            return {
                success: true,
                updatedRange: response.data.updates?.updatedRange,
                updatedRows: response.data.updates?.updatedRows,
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('[Sheets] Append error:', message);
            return {
                success: false,
                error: message,
            };
        }
    }
    /**
     * Clear sheet content (except header)
     */
    async clearSheet(sheetName?: string): Promise<boolean> {
        if (!this.sheets) {
            await this.initializeClient();
        }
        const targetSheet = sheetName || this.config?.sheetName || 'Sheet1';
        try {
            // Get the sheet metadata to find the row count
            const meta = await this.sheets.spreadsheets.get({
                spreadsheetId: this.config?.spreadsheetId,
            });
            const sheet = meta.data.sheets?.find((s: any) => s.properties?.title === targetSheet);
            if (sheet && sheet.properties?.gridProperties?.rowCount > 1) {
                // Clear all rows except header (row 1)
                await this.sheets.spreadsheets.values.clear({
                    spreadsheetId: this.config?.spreadsheetId,
                    range: `${targetSheet}!A2:Z`,
                });
            }
            return true;
        }
        catch (error) {
            console.error('[Sheets] Clear error:', error);
            return false;
        }
    }
    /**
     * Add header row if sheet is empty - COMPREHENSIVE HEADERS
     */
    async ensureHeader(sheetName?: string): Promise<boolean> {
        if (!this.sheets) {
            await this.initializeClient();
        }
        const targetSheet = sheetName || this.config?.sheetName || 'Sheet1';
        const headers = [
            'URL',
            'Issue Type',
            'Category',
            'Severity',
            'Title',
            'Title Length',
            'Title Pixels',
            'H1',
            'H1 Length',
            'H2',
            'H2 Length',
            'Meta Description',
            'Meta Desc Length',
            'Meta Desc Pixels',
            'Status Code',
            'Word Count',
            'Page Size',
            'Response Time',
            'Crawl Depth',
            'Inlinks',
            'Canonical',
            'Rel Next',
            'Rel Prev',
            'Meta Robots',
            'Redirect Type',
            'Meta Refresh',
            'PSI Mobile',
            'PSI Desktop',
            'Duplicate Title',
            'Duplicate H1',
            'Duplicate Meta Desc',
            'Campaign URLs',
            'Analytics Type',
            'Image Count',
            'Images Missing Alt',
            'Large Images (>100KB)',
            'Structured Data',
            'Schema Errors',
            'Crawl Date',
            'Site URL',
        ];
        try {
            // Check if header exists
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.config?.spreadsheetId,
                range: `${targetSheet}!A1:AN1`,
            });
            const existingHeaders = response.data.values?.[0];
            if (!existingHeaders || existingHeaders.length === 0) {
                // Add header
                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.config?.spreadsheetId,
                    range: `${targetSheet}!A1:AN1`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: [headers],
                    },
                });
                console.log('[Sheets] Added header row');
            }
            return true;
        }
        catch (error) {
            console.error('[Sheets] Header check error:', error);
            return false;
        }
    }
    /**
     * Export crawl issues to Google Sheets
     */
    async exportCrawlIssues(crawlResult: any, siteUrl: string, options?: { sheetName?: string; clearExisting?: boolean }): Promise<{ success: boolean; issuesFound: number; rowsExported: number; error?: string }> {
        try {
            // Extract issues
            const issues = extractOnPageIssues(crawlResult, siteUrl);
            const rows = issuesToSheetRows(issues);
            if (rows.length === 0) {
                return {
                    success: true,
                    issuesFound: 0,
                    rowsExported: 0,
                };
            }
            // Ensure header exists
            await this.ensureHeader(options?.sheetName);
            // Clear existing data if requested
            if (options?.clearExisting) {
                await this.clearSheet(options?.sheetName);
            }
            // Append new rows
            const result = await this.appendRows(rows, options?.sheetName);
            return {
                success: result.success,
                issuesFound: issues.length,
                rowsExported: result.updatedRows || 0,
                error: result.error,
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return {
                success: false,
                issuesFound: 0,
                rowsExported: 0,
                error: message,
            };
        }
    }
    /**
     * Export audit checklist to Google Sheets (question-based format)
     */
    async exportAuditChecklist(crawlResult: any, siteUrl: string, options?: { sheetName?: string; clearExisting?: boolean }) {
        try {
            // Extract issues
            const issues = extractOnPageIssues(crawlResult, siteUrl);
            // Generate checklist
            const checklist = generateAuditChecklist(issues);
            const rows = checklistToSheetRows(checklist);
            if (rows.length === 0) {
                return {
                    success: true,
                    questionsAnswered: 0,
                    issuesFound: 0,
                    rowsExported: 0,
                };
            }
            // Ensure header for checklist
            await this.ensureChecklistHeader(options?.sheetName);
            // Clear existing data if requested
            if (options?.clearExisting) {
                await this.clearSheet(options?.sheetName);
            }
            // Append checklist rows
            const result = await this.appendChecklistRows(rows, options?.sheetName);
            const failedCount = checklist.filter(c => c.statut === 'Échoué').length;
            return {
                success: result.success,
                questionsAnswered: checklist.length,
                issuesFound: failedCount,
                rowsExported: result.updatedRows || 0,
                error: result.error,
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return {
                success: false,
                questionsAnswered: 0,
                issuesFound: 0,
                rowsExported: 0,
                error: message,
            };
        }
    }

    /**
     * Append checklist rows
     */
    async appendChecklistRows(rows: any[], sheetName?: string) {
        if (!this.sheets) {
            await this.initializeClient();
        }
        const targetSheet = sheetName || this.config?.sheetName || 'Sheet1';
        const values = rows.map(row => [
            row['N°'],
            row['Actif'],
            row['Question'],
            row['Statut'],
            row['Assigné'],
            row['Outil'],
            row['Notes'],
            row['Catégorie'],
        ]);
        try {
            const response = await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.config?.spreadsheetId,
                range: `${targetSheet}!A:A`,
                valueInputOption: 'USER_ENTERED',
                insertDataOption: 'INSERT_ROWS',
                requestBody: { values },
            });
            return {
                success: true,
                updatedRows: response.data.updates?.updatedRows,
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('[Sheets] Checklist append error:', message);
            return { success: false, error: message };
        }
    }
    /**
     * Ensure checklist header exists
     */
    async ensureChecklistHeader(sheetName?: string) {
        if (!this.sheets) {
            await this.initializeClient();
        }
        const targetSheet = sheetName || this.config?.sheetName || 'Sheet1';
        const headers = ['N°', 'Actif', 'Question', 'Statut', 'Assigné', 'Outil', 'Notes', 'Catégorie'];
        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.config?.spreadsheetId,
                range: `${targetSheet}!A1:H1`,
            });
            const existingHeaders = response.data.values?.[0];
            if (!existingHeaders || existingHeaders.length === 0) {
                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.config?.spreadsheetId,
                    range: `${targetSheet}!A1:H1`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: [headers],
                    },
                });
                console.log('[Sheets] Added checklist header row');
            }
            return true;
        }
        catch (error) {
            console.error('[Sheets] Checklist header error:', error);
            return false;
        }
    }
    /**
     * Create a new spreadsheet and export audit checklist
     * This is called automatically after each crawl
     * @param crawlResult - The crawl result data
     * @param siteUrl - The site URL
     * @param options - Optional precomputed issues (includes GSC issues)
     */
    async exportToNewSpreadsheet(crawlResult: any, siteUrl: string, options?: {
        precomputedIssues?: any[];
        gscPageAnalytics?: Map<string, { clicks: number }>;
        backlinkData?: { domainRating: number; totalRefdomains: number; totalBacklinks: number };
}): Promise<{
        success: boolean;
        spreadsheetId?: string;
        spreadsheetUrl?: string;
        questionsAnswered?: number;
        issuesFound?: number;
        pagesExported?: number;
        imagesExported?: number;
        problemsExported?: number;
        seoIssuesExported?: number;
        problemImagesExported?: number;
        fourOhFourExported?: number;
        backlinksExported?: number;
        error?: string;
    }> {
        try {
            if (!this.sheets) {
                await this.initializeClient();
            }

            // Extract domain for naming
            let domain = siteUrl;
            try {
                domain = new URL(siteUrl).hostname;
            } catch {
                domain = siteUrl.replace(/^https?:\/\//, '').split('/')[0];
            }

            // Generate spreadsheet name with date
            const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            const spreadsheetName = `${domain} - ${date}`;

            console.log(`[Sheets] Creating new spreadsheet: ${spreadsheetName}`);

            // Create new spreadsheet using Drive API
            const drive = google.drive({ version: 'v3', auth: await this.getAuth() });
            
            const fileMetadata = {
                name: spreadsheetName,
                mimeType: 'application/vnd.google-apps.spreadsheet',
            };

            const driveResponse = await drive.files.create({
                requestBody: fileMetadata,
                fields: 'id, webViewLink',
            });

            const newSpreadsheetId = driveResponse.data.id;
            const spreadsheetUrl = driveResponse.data.webViewLink ?? undefined;

            if (!newSpreadsheetId) {
                throw new Error('Failed to create new spreadsheet');
            }

            console.log(`[Sheets] Created spreadsheet with ID: ${newSpreadsheetId}`);

            // Use precomputed issues if provided (includes GSC), otherwise extract from crawl
            const issues = options?.precomputedIssues || extractOnPageIssues(crawlResult, siteUrl);
            console.log(`[Sheets] Using ${issues.length} issues (GSC included: ${options?.precomputedIssues ? 'yes' : 'no'})`);
            const checklist = generateAuditChecklist(issues);
            const rows = checklistToSheetRows(checklist);

            // Get the actual sheet name from the new spreadsheet
            const spreadsheetInfo = await this.sheets.spreadsheets.get({
                spreadsheetId: newSpreadsheetId,
            });
            const actualSheetName = spreadsheetInfo.data.sheets?.[0]?.properties?.title || 'Sheet1';
            console.log(`[Sheets] Using sheet name: ${actualSheetName}`);

            // Add checklist header
            const headers = ['N°', 'Actif', 'Question', 'Statut', 'Assigné', 'Outil', 'Notes', 'Catégorie'];
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: newSpreadsheetId,
                range: `${actualSheetName}!A1:H1`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [headers],
                },
            });

            // Add checklist data
            if (rows.length > 0) {
                const values = rows.map((row: any) => [
                    row['N°'],
                    row['Actif'],
                    row['Question'],
                    row['Statut'],
                    row['Assigné'],
                    row['Outil'],
                    row['Notes'],
                    row['Catégorie'],
                ]);

                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: newSpreadsheetId,
                    range: `${actualSheetName}!A2:H${rows.length + 1}`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values },
                });
            }

            const failedCount = checklist.filter((c: any) => c.statut === 'Échoué').length;
            console.log(`[Sheets] Exported ${checklist.length} questions, ${failedCount} failed`);

            // Create second sheet with page data
            console.log(`[Sheets] Creating Pages sheet...`);
            const pageHeaders = ['Pages du site', 'Code HTTP', 'Balise TITLE', 'Meta Robots', 'URL Canonique', 'rel="next"', 'rel="prev"', 'Profondeur', 'Liens internes entrants', 'Trafic organique'];

            // Prepare page rows from crawl result
            const pageRows = pagesToSheetRows(crawlResult.pages || [], options?.gscPageAnalytics);
            const pageCount = pageRows.length;
            console.log(`[Sheets] Pages: ${pageCount} URLs`);

            if (pageCount > 0) {
                // Create new sheet for Pages
                const createSheetRequest = {
                    requests: [{
                        addSheet: {
                            properties: {
                                title: 'Pages',
                                gridProperties: {
                                    rowCount: Math.max(pageCount + 1, 1000),
                                    columnCount: 10
                                }
                            }
                        }
                    }]
                };

                await this.sheets.spreadsheets.batchUpdate({
                    spreadsheetId: newSpreadsheetId,
                    requestBody: createSheetRequest
                });

                // Add header row
                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: newSpreadsheetId,
                    range: 'Pages!A1:J1',
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: [pageHeaders]
                    }
                });

                // Add page data
                const pageValues = pageRows.map((row: any) => [
                    row['Pages du site'],
                    row['Code HTTP'],
                    row['Balise TITLE'],
                    row['Meta Robots'],
                    row['URL Canonique'],
                    row['rel="next"'],
                    row['rel="prev"'],
                    row['Profondeur'],
                    row['Liens internes entrants'],
                    row['Trafic organique'],
                ]);

                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: newSpreadsheetId,
                    range: `Pages!A2:${pageCount + 1}`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: pageValues }
                });
            }

            // Create third sheet with image data
            console.log(`[Sheets] Creating Images sheet...`);
            const imageHeaders = ['URL des images', 'Poids de l\'image (octets)'];
            
            // Extract all images from all pages
            const imageRows = imagesToSheetRows(crawlResult.images || []);
            const imageCount = imageRows.length;
            console.log(`[Sheets] Images: ${imageCount} total`);

            // Always create the sheet, even if empty
            // Create new sheet for Images
            const createImageSheetRequest = {
                requests: [{
                    addSheet: {
                        properties: {
                            title: 'Images',
                            gridProperties: {
                                rowCount: 1000,
                                columnCount: 2
                            }
                        }
                    }
                }]
            };

            await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId: newSpreadsheetId,
                requestBody: createImageSheetRequest
            });

            // Add header row
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: newSpreadsheetId,
                range: 'Images!A1:B1',
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [imageHeaders]
                }
            });

            // Add image data if any
            if (imageCount > 0) {
                const imageValues = imageRows.map((row: any) => [
                    row['URL des images'],
                    row['Poids de l\'image (octets)'],
                ]);

                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: newSpreadsheetId,
                    range: `Images!A2:${imageCount + 1}`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: imageValues }
                });
            }

            // Create fourth sheet with technical problems (non-200 pages)
            console.log(`[Sheets] Creating Problèmes techniques sheet...`);
            const problemHeaders = ['URL de la page', 'Code http', 'Status'];
            
            const problemRows = problemsToSheetRows(crawlResult.pages || []);
            const problemCount = problemRows.length;
            console.log(`[Sheets] Problèmes techniques: ${problemCount} pages with issues`);

            const createProblemSheetRequest = {
                requests: [{
                    addSheet: {
                        properties: {
                            title: 'Problèmes techniques',
                            gridProperties: {
                                rowCount: Math.max(problemCount + 1, 100),
                                columnCount: 3
                            }
                        }
                    }
                }]
            };

            await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId: newSpreadsheetId,
                requestBody: createProblemSheetRequest
            });

            await this.sheets.spreadsheets.values.update({
                spreadsheetId: newSpreadsheetId,
                range: 'Problèmes techniques!A1:C1',
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [problemHeaders]
                }
            });

            if (problemCount > 0) {
                const problemValues = problemRows.map((row: any) => [
                    row['URL de la page'],
                    row['Code http'],
                    row['Status'],
                ]);

                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: newSpreadsheetId,
                    range: `Problèmes techniques!A2:C${problemCount + 1}`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: problemValues }
                });
            }

            // Create fifth sheet with SEO issues grouped by URL
            console.log(`[Sheets] Creating Problèmes SEO sheet...`);
            const seoIssueRows = issuesToGroupedRows(issues);
            const seoIssueCount = seoIssueRows.length;
            console.log(`[Sheets] Problèmes SEO: ${seoIssueCount} issues`);

            const seoIssueHeaders = Object.keys(seoIssueRows[0] || {});

            const createSeoIssueSheetRequest = {
                requests: [{
                    addSheet: {
                        properties: {
                            title: 'Problèmes SEO',
                            gridProperties: {
                                rowCount: Math.max(seoIssueCount + 1, 100),
                                columnCount: seoIssueHeaders.length
                            }
                        }
                    }
                }]
            };

            await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId: newSpreadsheetId,
                requestBody: createSeoIssueSheetRequest
            });

            await this.sheets.spreadsheets.values.update({
                spreadsheetId: newSpreadsheetId,
                range: 'Problèmes SEO!A1',
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [seoIssueHeaders]
                }
            });

            if (seoIssueCount > 0) {
                const seoIssueValues = seoIssueRows.map((row: any) =>
                    seoIssueHeaders.map(header => row[header] ?? '')
                );

                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: newSpreadsheetId,
                    range: `Problèmes SEO!A2:${seoIssueCount + 1}`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: seoIssueValues }
                });
            }

            // Create sixth sheet with problem images
            console.log(`[Sheets] Creating Images problématiques sheet...`);
            const problemImageRows = problemImagesToSheetRows(crawlResult.images || []);
            const problemImageCount = problemImageRows.length;
            console.log(`[Sheets] Images problématiques: ${problemImageCount} problem images`);

            const problemImageHeaders = Object.keys(problemImageRows[0] || {});

            const createProblemImageSheetRequest = {
                requests: [{
                    addSheet: {
                        properties: {
                            title: 'Images problématiques',
                            gridProperties: {
                                rowCount: Math.max(problemImageCount + 1, 100),
                                columnCount: problemImageHeaders.length
                            }
                        }
                    }
                }]
            };

            await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId: newSpreadsheetId,
                requestBody: createProblemImageSheetRequest
            });

            await this.sheets.spreadsheets.values.update({
                spreadsheetId: newSpreadsheetId,
                range: 'Images problématiques!A1',
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [problemImageHeaders]
                }
            });

            if (problemImageCount > 0) {
                const problemImageValues = problemImageRows.map((row: any) =>
                    problemImageHeaders.map(header => row[header] ?? '')
                );

                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: newSpreadsheetId,
                    range: `Images problématiques!A2:${problemImageCount + 1}`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: problemImageValues }
                });
            }

            // Create seventh sheet with 404 URLs
            console.log(`[Sheets] Creating URLs 404 sheet...`);
            const fourOhFourRows = fourOhFourToSheetRows(crawlResult.pages || []);
            const fourOhFourCount = fourOhFourRows.length;
            console.log(`[Sheets] URLs 404: ${fourOhFourCount} pages`);

            const fourOhFourHeaders = Object.keys(fourOhFourRows[0] || {});

            const createFourOhFourSheetRequest = {
                requests: [{
                    addSheet: {
                        properties: {
                            title: 'URLs 404',
                            gridProperties: {
                                rowCount: Math.max(fourOhFourCount + 1, 100),
                                columnCount: fourOhFourHeaders.length
                            }
                        }
                    }
                }]
            };

            await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId: newSpreadsheetId,
                requestBody: createFourOhFourSheetRequest
            });

            await this.sheets.spreadsheets.values.update({
                spreadsheetId: newSpreadsheetId,
                range: 'URLs 404!A1',
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [fourOhFourHeaders]
                }
            });

            if (fourOhFourCount > 0) {
                const fourOhFourValues = fourOhFourRows.map((row: any) =>
                    fourOhFourHeaders.map(header => row[header] ?? '')
                );

                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: newSpreadsheetId,
                    range: `URLs 404!A2:${fourOhFourCount + 1}`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: fourOhFourValues }
                });
            }

            return {
                success: true,
                spreadsheetId: newSpreadsheetId,
                spreadsheetUrl,
                questionsAnswered: checklist.length,
                issuesFound: failedCount,
                pagesExported: pageCount,
                imagesExported: imageCount,
                problemsExported: problemCount,
                seoIssuesExported: seoIssueCount,
                problemImagesExported: problemImageCount,
                fourOhFourExported: fourOhFourCount,
                backlinksExported: 0,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('[Sheets] Create new spreadsheet error:', message);
            return {
                success: false,
                error: message,
            };
        }
    }
}

// Export singleton instance
export const sheetsService = new GoogleSheetsService();
//# sourceMappingURL=sheets-service.js.map