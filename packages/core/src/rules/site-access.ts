import { REQUIRED_PAGE_TYPES } from "../constants.ts";
import { keywordCoverage } from "../utils.ts";
import { addIssue, defineFinalRule, defineSiteRule, pageText } from "./registry.ts";

export const siteAccessRules = [
  defineSiteRule("site-access", (context) => {
    const { crawl, issues } = context;

    if (!crawl.robots.exists) {
      addIssue(issues, {
        severity: "warn",
        scope: "site",
        category: "crawlability",
        bucket: "access",
        title: "Missing robots.txt",
        message: "No robots.txt file was discovered at the site root.",
        fixHint: "Add robots.txt and advertise your sitemap."
      });
    }

    if (crawl.discoveredUrls.length === 0) {
      addIssue(issues, {
        severity: "warn",
        scope: "site",
        category: "crawlability",
        bucket: "access",
        title: "Missing sitemap discovery",
        message: "No crawl targets were discovered from a sitemap or fallback scan.",
        fixHint: "Publish a sitemap.xml or expose crawlable HTML entrypoints."
      });
    }

    if (crawl.robots.blockedAll) {
      addIssue(issues, {
        severity: "error",
        scope: "site",
        category: "crawlability",
        bucket: "access",
        title: "Robots blocks all crawlers",
        message: "robots.txt blocks the entire site for the wildcard user agent.",
        fixHint: "Allow public product and docs content to be crawled."
      });
    }

    for (const bot of crawl.robots.blockedAiBots) {
      addIssue(issues, {
        severity: "warn",
        scope: "site",
        category: "crawlability",
        bucket: "access",
        title: `${bot} is blocked`,
        message: `${bot} is explicitly blocked in robots.txt.`,
        fixHint: `Allow ${bot} if you want discoverability on that answer surface.`
      });
    }
  })
];

export const siteFinalRules = [
  defineFinalRule("homepage-positioning", (context) => {
    const { issues, input, byUrl } = context;
    const homepage = context.pageTypes.get("home")?.[0];

    if (!homepage) {
      addIssue(issues, {
        severity: "error",
        scope: "site",
        category: "coverage",
        bucket: "access",
        title: "Homepage was not crawled",
        message: "The crawl did not yield a homepage record.",
        fixHint: "Ensure the homepage is public and discoverable."
      });
      return;
    }

    const homeText = pageText(homepage);

    if (keywordCoverage(homeText, input.brand.brand.category) < 0.5) {
      addIssue(issues, {
        severity: "warn",
        scope: "page",
        category: "positioning",
        bucket: "entityClarity",
        title: "Homepage category signal is weak",
        message: "The homepage does not clearly reinforce the declared product category.",
        fixHint: "Name the category directly in the hero or early supporting copy.",
        pageUrl: homepage.url
      });
    }

    if (
      input.brand.brand.target_personas.length > 0 &&
      !input.brand.brand.target_personas.some((persona) => keywordCoverage(homeText, persona) >= 0.5)
    ) {
      addIssue(issues, {
        severity: "info",
        scope: "page",
        category: "positioning",
        bucket: "entityClarity",
        title: "Homepage persona fit is implicit",
        message: "Target personas are not clearly named on the homepage.",
        fixHint: "Call out the primary team or buyer in visible homepage text.",
        pageUrl: homepage.url
      });
    }

    if (
      input.brand.brand.key_use_cases.length > 0 &&
      !input.brand.brand.key_use_cases.some((useCase) => keywordCoverage(homeText, useCase) >= 0.5)
    ) {
      addIssue(issues, {
        severity: "info",
        scope: "page",
        category: "positioning",
        bucket: "entityClarity",
        title: "Homepage use cases are underspecified",
        message: "The homepage does not clearly mention the product's primary jobs to be done.",
        fixHint: "Add use-case language near the hero and supporting sections.",
        pageUrl: homepage.url
      });
    }

    const linkedTypes = new Set(
      homepage.internalLinks
        .map((url) => byUrl.get(url)?.pageType)
        .filter((pageType) => pageType !== undefined && pageType !== "home")
    );

    if (linkedTypes.size < 3) {
      addIssue(issues, {
        severity: "warn",
        scope: "page",
        category: "coverage",
        bucket: "comparativeReadiness",
        title: "Homepage under-links key proof pages",
        message: "The homepage links to too few key proof pages to drive strong downstream discovery.",
        fixHint: "Link from the homepage to pricing, docs, security, FAQ, or compare pages.",
        pageUrl: homepage.url
      });
    }
  }),
  defineFinalRule("coverage", (context) => {
    const { issues, pageTypes, input, missingPageTypes } = context;

    for (const requirement of REQUIRED_PAGE_TYPES) {
      if ((pageTypes.get(requirement.pageType) ?? []).length > 0) {
        continue;
      }

      missingPageTypes.push(requirement.pageType);
      addIssue(issues, {
        severity: requirement.severity,
        scope: "site",
        category: "coverage",
        bucket: requirement.bucket,
        title: `Missing ${requirement.title}`,
        message: `No ${requirement.pageType} page was discovered.`,
        fixHint: `Add a dedicated ${requirement.pageType} page with clear, citable content.`
      });
    }

    if ((pageTypes.get("use-case") ?? []).length < 3) {
      addIssue(issues, {
        severity: "info",
        scope: "site",
        category: "coverage",
        bucket: "comparativeReadiness",
        title: "Use-case coverage is thin",
        message: "Fewer than three use-case pages were discovered.",
        fixHint: "Add more use-case or solution pages for distinct buyer contexts."
      });
    }

    const comparePages = pageTypes.get("compare") ?? [];
    if (comparePages.length === 0 || input.competitors.competitors.length === 0) {
      return;
    }

    const compareText = comparePages.map((page) => page.textSnippet.toLowerCase()).join(" ");
    const mentionsCompetitor = input.competitors.competitors.some((competitor) =>
      compareText.includes(competitor.name.toLowerCase())
    );

    if (!mentionsCompetitor) {
      addIssue(issues, {
        severity: "info",
        scope: "site",
        category: "comparison",
        bucket: "comparativeReadiness",
        title: "Compare pages do not mention declared competitors",
        message: "Compare-oriented pages exist, but they do not name any declared competitors.",
        fixHint: "Add explicit alternatives or versus pages for the highest-priority competitors."
      });
    }
  })
];
