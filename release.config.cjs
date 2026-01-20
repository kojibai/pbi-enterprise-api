module.exports = {
  branches: ["main"],
  plugins: [
    ["@semantic-release/commit-analyzer", { preset: "conventionalcommits" }],
    ["@semantic-release/release-notes-generator", { preset: "conventionalcommits" }],
    ["@semantic-release/npm", { pkgRoot: "packages/presencebound-sdk", npmPublish: true }],
    "@semantic-release/github"
  ]
};
