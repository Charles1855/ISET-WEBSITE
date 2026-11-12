document.addEventListener("DOMContentLoaded", function () {
  /* ---------- Mobile nav toggle ---------- */
  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      links.classList.toggle("is-open", !open);
      document.body.style.overflow = !open ? "hidden" : "";
    });

    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        toggle.setAttribute("aria-expanded", "false");
        links.classList.remove("is-open");
        document.body.style.overflow = "";
      });
    });
  }

  /* ---------- Multi-page Active Nav State Fallback ---------- */
  var currentPath = window.location.pathname.split("/").pop() || "index.html";
  var navLinksList = document.querySelectorAll(".nav-links a");
  navLinksList.forEach(function (a) {
    var href = a.getAttribute("href");
    if (href === currentPath || (currentPath === "" && href === "index.html")) {
      a.setAttribute("aria-current", "page");
    }
  });

  /* ---------- Scroll reveal ---------- */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -30px 0px" }
    );
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* Stagger children of .reveal-stagger via CSS variable --i */
  document.querySelectorAll(".reveal-stagger").forEach(function (group) {
    Array.prototype.forEach.call(group.children, function (child, i) {
      child.style.setProperty("--i", i);
    });
  });

  /* ---------- Partner-with-us / enquiry form (sent via our own backend) ---------- */
  var API_URL =
    location.hostname === "localhost" || location.hostname === "127.0.0.1"
      ? "http://localhost:3000/api/contact"
      : "https://YOUR-BACKEND-URL/api/contact"; // <-- replace after deploying the backend

  var partnerForm = document.getElementById("partner-form");
  if (partnerForm) {
    var errorBox = document.createElement("p");
    errorBox.className = "form-error";
    errorBox.setAttribute("role", "alert");
    errorBox.hidden = true;

    var submitBtn = partnerForm.querySelector("button[type=submit]");
    submitBtn.parentNode.insertBefore(errorBox, submitBtn);

    function field(name) {
      var el = partnerForm.querySelector("[name=" + name + "]");
      return el ? el.value : "";
    }

    partnerForm.addEventListener("submit", function (e) {
      e.preventDefault();
      errorBox.hidden = true;

      if (!partnerForm.checkValidity()) {
        partnerForm.reportValidity();
        return;
      }

      var originalText = submitBtn.textContent;
      submitBtn.textContent = "Sending…";
      submitBtn.disabled = true;

      // The server may be waking up on free hosting, so allow up to 60 seconds
      var controller = new AbortController();
      var timer = setTimeout(function () { controller.abort(); }, 60000);

      fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          name: field("name"),
          email: field("email"),
          organisation: field("organisation"),
          interest: field("interest"),
          message: field("message"),
          website: field("website"), // honeypot, must stay empty for real visitors
        }),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            if (!res.ok || !data.ok) throw new Error(data.error || "Request failed");
            return data;
          });
        })
        .then(function () {
          partnerForm.closest(".form-card").classList.add("is-submitted");
        })
        .catch(function (err) {
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
          errorBox.textContent =
            err.name === "AbortError"
              ? "The server took too long to respond. Please try again."
              : err.message === "Failed to fetch"
              ? "Could not reach the server. Check your connection and try again."
              : err.message;
          errorBox.hidden = false;
          console.error(err);
        })
        .finally(function () {
          clearTimeout(timer);
        });
    });
  }

  /* ---------- Footer year ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
});

