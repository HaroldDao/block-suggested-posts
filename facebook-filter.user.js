// ==UserScript==
// @name         Block suggested posts on Facebook
// @namespace    //
// @version      1.0.0
// @description  Filter out suggested posts & recommended groups on Facebook Newsfeed
// @author       Harold Dao & AI
// @match        https://www.facebook.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=facebook.com
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    console.log("=== Fb ext v1: MutationObserver Edition ===");

    let removedCount = 0;

    // ─── Keywords to filter ────────────────────────────────────────────────────
    const GARBAGE_LABELS = new Set([
        'Follow Page',
        'Like Page',
        'Theo dõi Trang',
        'Thích Trang',
        'Join',
        'Tham gia',
        'Suggested for you',
        'Được đề xuất cho bạn',
        'Suggested Post',
        'Bài viết được đề xuất',
        'Sponsored',
        'Được tài trợ',
    ]);

    // ─── Check if a post is garbage ───────────────────────────────────────────
    function isGarbagePost(post) {
        // Strategy 1: check aria-label on action buttons (most reliable)
        const actionButtons = post.querySelectorAll('[role="button"], a[role="link"]');
        for (const btn of actionButtons) {
            const label = (btn.getAttribute('aria-label') || '').trim();
            if (GARBAGE_LABELS.has(label)) return true;
        }

        // Strategy 2: check text of short spans (Follow/Join buttons)
        // Only look at spans with short text (<= 30 chars) to avoid scanning full post content
        const spans = post.querySelectorAll('span');
        for (const span of spans) {
            // Only grab direct text of this span, not its children
            const directText = Array.from(span.childNodes)
                .filter(n => n.nodeType === Node.TEXT_NODE)
                .map(n => n.textContent.trim())
                .join('');
            if (directText.length > 0 && directText.length <= 30 && GARBAGE_LABELS.has(directText)) {
                return true;
            }
        }

        // Strategy 3: check data-attributes Facebook usually sets for sponsored posts
        if (
            post.querySelector('[data-testid="story-sponsored-label"]') ||
            post.querySelector('a[href*="ads/about"]')
        ) {
            return true;
        }

        return false;
    }

    // ─── Check if a post has fully loaded its content ─────────────────────────
    // Facebook renders lazily — if there are no spans yet, content may not be ready
    function isPostLoaded(post) {
        return post.querySelectorAll('span').length > 3;
    }

    // ─── Process a single post ────────────────────────────────────────────────
    function checkPost(post) {
        if (post.dataset.fbFilterDone) return; // already processed, skip

        if (!isPostLoaded(post)) {
            // Not fully loaded yet — do NOT mark, allow re-scan later
            return;
        }

        if (isGarbagePost(post)) {
            removedCount++;
            console.log(`[Filtered] Removed post #${removedCount}`);
            post.remove();
        } else {
            // Fully loaded and clean — mark so we don't re-scan
            post.dataset.fbFilterDone = '1';
        }
    }

    // ─── Scan all posts currently on the page ─────────────────────────────────
    function scanAll() {
        const posts = document.querySelectorAll(
            'div[aria-posinset], div[data-pagelet^="FeedUnit_"]'
        );
        posts.forEach(checkPost);
    }

    // ─── MutationObserver: only runs when the DOM actually changes ────────────
    const observer = new MutationObserver((mutations) => {
        let needsScan = false;
        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                needsScan = true;
                break;
            }
        }
        if (needsScan) scanAll();
    });

    // Start observing once the page is ready
    function startObserver() {
        const feed = document.querySelector('[role="feed"]') || document.body;
        observer.observe(feed, { childList: true, subtree: true });
        console.log('[Filter] Now watching the feed...');
        scanAll(); // initial scan on startup
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserver);
    } else {
        startObserver();
    }

    // ─── Fallback: re-scan every 5 seconds for posts that loaded slowly ───────
    setInterval(scanAll, 5000);

})();