"""Temporary fixed-source PNG evidence collector; no image generation here."""
import hashlib
import json
import pathlib
import subprocess
import sys

REVISIONS = {
    "old": "61ef70cbdf6785d43fb8953965f404382a4ef894",
    "new": "d7777b8918076a5b64e474655eef1bf8e87da4b1",
}
MANIFEST = "docs/migration/media-local-processing-v1.json"


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def digest(data):
    return hashlib.sha256(data).hexdigest()


def command(source, args):
    return subprocess.check_output(args, cwd=source, text=True).strip()


def prepare(root):
    for side, revision in REVISIONS.items():
        assert command(root / side, ["git", "rev-parse", "HEAD"]) == revision
    old = read_json(root / "old" / MANIFEST)
    new = read_json(root / "new" / MANIFEST)
    by_key = {(r["contentId"], r["assetId"]): r for r in old["records"]}
    rows = []
    for new_record in new["records"]:
        old_record = by_key[(new_record["contentId"], new_record["assetId"])]
        if old_record["deliveryMaster"]["sha256"] == new_record["deliveryMaster"]["sha256"]:
            continue
        assert old_record["assetId"] == new_record["assetId"] == "social-card"
        assert old_record["sourceSha256"] == new_record["sourceSha256"]
        assert old_record["canonical"] == new_record["canonical"]
        assert old_record["canonical"]["format"] == "svg"
        assert old_record["deliveryMaster"]["format"] == new_record["deliveryMaster"]["format"] == "png"
        rows.append({
            "contentId": new_record["contentId"],
            "legacyContentId": new_record["legacyContentId"],
            "old": old_record["deliveryMaster"],
            "new": new_record["deliveryMaster"],
        })
    assert len(rows) == 28
    write_json(root / "expected.json", rows)
    write_json(root / "review" / "expected.json", rows)


def collect(root, side):
    source = (root / side).resolve()
    output = root / "review" / side
    output.mkdir(parents=True, exist_ok=True)
    rows = []
    for row in read_json(root / "expected.json"):
        expected = row[side]
        path = (source / expected["artifactRelativePath"]).resolve()
        path.relative_to(source)
        data = path.read_bytes() if path.is_file() else None
        actual = digest(data) if data is not None else None
        matched = actual == expected["sha256"]
        if matched:
            (output / (row["contentId"] + ".png")).write_bytes(data)
        rows.append({
            "contentId": row["contentId"],
            "legacyContentId": row["legacyContentId"],
            "expectedSha256": expected["sha256"],
            "actualSha256": actual,
            "matched": matched,
        })
    metadata = {
        "sourceSha": command(source, ["git", "rev-parse", "HEAD"]),
        "lockSha256": digest((source / "package-lock.json").read_bytes()),
        "expectedToolchainSha256": read_json(source / MANIFEST)["toolchainSha256"],
        "generatedSocialCardPngs": [
            {"sha256": digest(path.read_bytes()), "sizeBytes": path.stat().st_size}
            for path in sorted((source / ".local/migration/phase6/processing-artifact/public-master/public/social-card").glob("*.png"))
            if path.is_file()
        ],
    }
    for name, args in [
        ("node", ["node", "--version"]),
        ("npm", ["npm", "--version"]),
        ("sharpVersions", ["node", "-e", 'console.log(JSON.stringify(require(require.resolve("sharp",{paths:[process.cwd()+"/packages/media-ingest"]})).versions))']),
    ]:
        try:
            metadata[name] = command(source, args)
        except subprocess.CalledProcessError as error:
            metadata[name] = {"exitStatus": error.returncode}
    write_json(root / "review" / (side + ".json"), {"side": side, "toolchain": metadata, "rows": rows})
    print(side, sum(row["matched"] for row in rows), "/28 recorded hashes reproduced")


def check(root):
    for side, node, sharp in [("old", "v24.19.0", "0.35.4"), ("new", "v24.22.1", "0.35.5")]:
        report = read_json(root / "review" / (side + ".json"))
        assert report["toolchain"]["sourceSha"] == REVISIONS[side]
        assert report["toolchain"]["node"] == node
        assert report["toolchain"]["npm"] == "11.19.0"
        assert json.loads(report["toolchain"]["sharpVersions"])["sharp"] == sharp
        assert len(report["rows"]) == 28 and all(row["matched"] for row in report["rows"]), side + " recorded SHA mismatch"


if __name__ == "__main__":
    action, directory, *rest = sys.argv[1:]
    root = pathlib.Path(directory).resolve()
    if action == "prepare":
        prepare(root)
    elif action == "collect":
        assert rest == ["old"] or rest == ["new"]
        collect(root, rest[0])
    elif action == "check":
        check(root)
    else:
        raise ValueError(action)
