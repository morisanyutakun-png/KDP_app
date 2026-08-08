import { hash } from "bcryptjs";

async function main() {
  const password = process.argv[2];
  if (!password) {
    console.error("Usage: npm run auth:hash -- 'your-password'");
    process.exit(1);
  }
  console.log(await hash(password, 12));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
