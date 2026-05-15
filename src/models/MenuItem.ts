import {
  Table,
  Column,
  Model,
  DataType,
  BelongsTo,
  ForeignKey,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
} from "sequelize-typescript";
import { MenuGroup } from "./MenuGroup";

@Table({ tableName: "menu_items" })
export class MenuItem extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => MenuGroup)
  @Column(DataType.UUID)
  declare groupId: string;

  @BelongsTo(() => MenuGroup)
  declare group: MenuGroup;

  @Column(DataType.STRING)
  declare name: string;

  @Column(DataType.DECIMAL(10, 2))
  declare price: number;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare description: string | null;

  @Default([])
  @Column(DataType.JSON)
  declare dietaryTags: string[];

  @Default(0)
  @Column(DataType.INTEGER)
  declare order: number;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
