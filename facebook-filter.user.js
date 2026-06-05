// ==UserScript==
// @name         Block suggested posts on Facebook
// @namespace    //
// @version      2.0.0
// @description  Filter out suggested posts & recommended groups on Facebook Newsfeed
// @author       Harold Dao & AI
// @match        https://www.facebook.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=facebook.com
// @grant        none
// ==/UserScript==
// Thanks to Claude and Gemini for supporting me in this project <333

(function () {
    'use strict';

    console.log("=== Fb Filter v2.0: MutationObserver Edition ===");

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
        'Follow', 
        'Theo dõi',
    ]);

    // ─── Check if a post header is fully rendered ─────────────────────────────
    function isPostReady(post) {
        const profileName = post.querySelector('[data-ad-rendering-role="profile_name"]');
        if (!profileName) return false;
        return post.querySelectorAll('span').length > 10;
    }

    // ─── Get the label text of a button/link element ──────────────────────────
    function getButtonText(btn) {
        const label = (btn.getAttribute('aria-label') || '').trim();
        if (label && label.length <= 50) return label;

        for (const span of btn.querySelectorAll('span')) {
            if (span.querySelector('canvas')) continue;
            if (span.closest('a[href^="?"]')) continue;
            const t = span.textContent.trim();
            if (t.length > 0 && t.length <= 30) return t;
        }
        return '';
    }

    // ─── Check if a post is garbage ───────────────────────────────────────────
    function isGarbagePost(post) {
        // // Strategy 1: check aria-label on action buttons (most reliable)
        // const actionButtons = post.querySelectorAll('[role="button"], a[role="link"]');
        // for (const btn of actionButtons) {
        //     const label = (btn.getAttribute('aria-label') || '').trim();
        //     if (GARBAGE_LABELS.has(label)) return true;
        // }

        // // Strategy 2: check text of short spans (Follow/Join buttons)
        // // Only look at spans with short text (<= 30 chars) to avoid scanning full post content
        // const spans = post.querySelectorAll('span');
        // for (const span of spans) {
        //     // Only grab direct text of this span, not its children
        //     const directText = Array.from(span.childNodes)
        //         .filter(n => n.nodeType === Node.TEXT_NODE)
        //         .map(n => n.textContent.trim())
        //         .join('');
        //     if (directText.length > 0 && directText.length <= 30 && GARBAGE_LABELS.has(directText)) {
        //         return true;
        //     }
        // }

        // Strategy 3: check data-attributes Facebook usually sets for sponsored posts
        if (
            post.querySelector('[data-testid="story-sponsored-label"]') ||
            post.querySelector('a[href*="ads/about"]')
        ) {
            return true;
        }

        // Strategy 4: check ONLY inside the profile_name header zone.
        // Join/Follow/Sponsored in this zone always means suggested/spam.
        const profileNameZone = post.querySelector('[data-ad-rendering-role="profile_name"]');
        if (profileNameZone) {
            const buttons = profileNameZone.querySelectorAll('[role="button"], a[role="link"]');
            for (const btn of buttons) {
                const text = getButtonText(btn);
                if (text && GARBAGE_LABELS.has(text)) return true;
            }
        }

        return false;
    }

    // ─── Process a single post ────────────────────────────────────────────────
    function checkPost(post) {
        if (post.dataset.fbFilterDone) return; // already processed, skip

        if (!isPostReady(post)) {
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

    // ─── Pause script 10s before execution ────────────────────────────────────
    function initAfterDelay() {
        console.log('[Filter] 10s delay finished. Starting filter...');

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', startObserver);
        } else {
            startObserver();
        }

        // Just run setInterval to scan after 10s delay finished
        setInterval(scanAll, 3000);
    }

    // Delay script for 10s form Tampermonkey load
    console.log('[Filter] Script loaded. Pausing for 10 seconds...');
    setTimeout(initAfterDelay, 10000);

})();