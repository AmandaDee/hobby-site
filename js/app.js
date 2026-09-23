// Add a small accessibility improvement:
// indicate when the user has navigated using the keyboard.

document.addEventListener("keydown", (event) => {
  if (event.key === "Tab") {
    document.body.classList.add("keyboard-user");
  }
});
