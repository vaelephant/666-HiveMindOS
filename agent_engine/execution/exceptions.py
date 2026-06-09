class ApprovalRequired(Exception):
    def __init__(
        self,
        step_id: str,
        reason: str = "",
        *,
        queue: list | None = None,
        checkpoints: dict | None = None,
    ):
        self.step_id = step_id
        self.reason = reason
        self.queue = queue
        self.checkpoints = checkpoints
        super().__init__(reason or f"approval required at {step_id}")
