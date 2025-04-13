import initApp from "./server";
const port = process.env.PORT;

console.log("Starting app...");
initApp()
  .then((app) => {
    app.listen(port, () => {
      console.log(`Example app listening at http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start app:", error);
  });
