import express from "express";
import {
  checkAndTouchSession,
  createSession,
  members,
  nextSubAccountId,
  PERMISSION_DENIED_ID,
  SLOW_LOAD_ID,
  SLOW_LOAD_MS,
} from "./db.js";
import * as tpl from "./templates.js";

function getCookie(req: express.Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return undefined;
}

export function createApp(): express.Express {
  const app = express();
  app.use(express.urlencoded({ extended: false }));

  function requireSession(req: express.Request, res: express.Response): boolean {
    const sessionId = getCookie(req, "LSESSIONID");
    const check = checkAndTouchSession(sessionId);
    if (!check.valid) {
      res.status(200).send(tpl.sessionExpired());
      return false;
    }
    return true;
  }

  app.get("/", (_req, res) => {
    res.send(tpl.frameset());
  });

  app.get("/login", (_req, res) => {
    res.send(tpl.loginForm());
  });

  app.post("/login", (req, res) => {
    const operatorId = String(req.body.operatorId ?? "").trim();
    if (!operatorId) {
      res.send(tpl.loginForm("Operator ID is required."));
      return;
    }
    const sessionId = createSession(operatorId);
    res.setHeader("Set-Cookie", `LSESSIONID=${sessionId}; Path=/; HttpOnly`);
    res.send(tpl.frameset());
  });

  app.get("/nav", (_req, res) => {
    res.send(tpl.nav());
  });

  app.get("/home", (req, res) => {
    if (!requireSession(req, res)) return;
    const sessionId = getCookie(req, "LSESSIONID")!;
    res.send(tpl.home(sessionId));
  });

  app.get("/members/search", (req, res) => {
    if (!requireSession(req, res)) return;
    res.send(tpl.memberSearchForm());
  });

  app.get("/members/lookup", async (req, res) => {
    if (!requireSession(req, res)) return;
    const memberId = String(req.query.memberId ?? "").trim();

    if (memberId === PERMISSION_DENIED_ID) {
      res.send(tpl.permissionDenied(memberId));
      return;
    }

    if (memberId === SLOW_LOAD_ID) {
      await new Promise((resolve) => setTimeout(resolve, SLOW_LOAD_MS));
    }

    const member = members[memberId];
    if (!member) {
      res.send(tpl.memberNotFound(memberId));
      return;
    }

    res.send(tpl.memberDetail(member));
  });

  app.get("/subaccounts/new", (req, res) => {
    if (!requireSession(req, res)) return;
    const memberId = String(req.query.memberId ?? "").trim();
    res.send(tpl.subAccountForm(memberId));
  });

  app.post("/subaccounts/review", (req, res) => {
    if (!requireSession(req, res)) return;
    const memberId = String(req.body.memberId ?? "").trim();
    const type = String(req.body.type ?? "").trim();
    const deposit = Number(req.body.deposit);

    const member = members[memberId];
    if (member?.status === "frozen") {
      res.send(
        tpl.subAccountValidationError(
          "This member's account is frozen; new sub-accounts cannot be opened.",
          memberId,
        ),
      );
      return;
    }
    if (!Number.isFinite(deposit) || deposit <= 0) {
      res.send(tpl.subAccountValidationError("Initial deposit must be a positive amount.", memberId));
      return;
    }

    res.send(tpl.subAccountReview(memberId, type, deposit));
  });

  app.post("/subaccounts/confirm", (req, res) => {
    if (!requireSession(req, res)) return;
    const memberId = String(req.body.memberId ?? "").trim();
    const type = String(req.body.type ?? "").trim();
    const deposit = Number(req.body.deposit);

    const member = members[memberId];
    if (!member) {
      res.send(tpl.memberNotFound(memberId));
      return;
    }

    const subAccountId = nextSubAccountId();
    member.subAccounts.push({ id: subAccountId, type, initialDeposit: deposit, openedAt: Date.now() });
    res.send(tpl.subAccountSuccess(memberId, subAccountId));
  });

  return app;
}
