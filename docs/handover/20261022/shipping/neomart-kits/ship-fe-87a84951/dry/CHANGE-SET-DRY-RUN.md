# Change-set dry run for 87a8495138f0af5303bc93397438238c6cc5081b (written by 02-dry; nothing was created)

Stack Capiro-Portfolio-Preview-Service, change set fable-fe-pr121-gate-87a84951: --use-previous-template, CAPABILITY_IAM, parameters = readback/stack-parameters.baseline.json with ONLY ImageUri changed.

## Template diff

None. The change set reuses the live template (Original, sha256 736a80c52991b5ca694f73727acccf4abd3446b360fa0666ad94258447f635ee, 17489 B).
The reviewed copy C:/dev/fable/frontend-meri-wire/REVIEWED_PREVIEW_TEMPLATE.yml is absent.

## Parameter diff

| Parameter | Baseline (rev 21) | Candidate |
| --- | --- | --- |
| ImageUri | `967807252336.dkr.ecr.us-east-1.amazonaws.com/capiro/portfolio-preview@sha256:8fc64defdc67c052d3eb31a7081194decf8bcedf3abb0166490ee2c3961d819b` | `967807252336.dkr.ecr.us-east-1.amazonaws.com/capiro/portfolio-preview@sha256:<digest from 05-image-readback>` |

The other 24 parameters are passed unchanged with explicit values (no UsePreviousValue).

## Expected changes (06-changeset refuses anything else)

- `Modify PreviewTaskDefinition` (AWS::ECS::TaskDefinition), Replacement True, caused only by ImageUri (plus the dynamic DirectModification CloudFormation always reports for container definitions).
- `Modify PreviewService` (AWS::ECS::Service), Replacement False, TaskDefinition only.

## Expected task definition

Revision 22 = revision 21 with only `containerDefinitions[0].image` changed (checked: every other field, all 26 environment variables and both secret references are equal). 08-verify checks this on the registered revision.
